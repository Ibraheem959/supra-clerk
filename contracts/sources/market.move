/// Clerk marketplace. CLERK pays for a job. It is not staked.
module clerk::market {
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use supra_framework::coin::{Self, Coin};
    use supra_framework::event;
    use supra_framework::timestamp;

    const FUNDED: u8 = 1;
    const COMPLETED: u8 = 2;
    const FAILED: u8 = 3;
    const REFUNDED: u8 = 4;

    const E_ADMIN: u64 = 1;
    const E_AGENT: u64 = 2;
    const E_PRICE: u64 = 3;
    const E_JOB: u64 = 4;
    const E_STATUS: u64 = 5;
    const E_AUTH: u64 = 6;
    const E_RATING: u64 = 7;
    const E_NAME: u64 = 8;
    const E_HASH: u64 = 9;
    const E_FEE: u64 = 10;
    const E_FAUCET: u64 = 11;
    const FAUCET_DRIP: u64 = 500_0000_0000;
    const FAUCET_WAIT: u64 = 3600;

    struct CLERK has key {}

    struct Caps has key {
        mint: coin::MintCapability<CLERK>,
        burn: coin::BurnCapability<CLERK>,
    }

    struct Config has key {
        admin: address,
        treasury: address,
        fee_bps: u64,
        review_secs: u64,
        next_agent: u64,
        next_job: u64,
        next_watch: u64,
    }

    struct Treasury has key {
        coins: Coin<CLERK>,
        fees: Coin<CLERK>,
    }

    struct Agent has store, copy, drop {
        id: u64,
        creator: address,
        name: String,
        description: String,
        category: String,
        price: u64,
        input_type: String,
        permissions: String,
        active: bool,
        completed: u64,
        failed: u64,
        rating_sum: u64,
        rating_count: u64,
        volume: u64,
    }

    struct Job has store, copy, drop {
        id: u64,
        user: address,
        agent_id: u64,
        amount: u64,
        fee: u64,
        input_hash: vector<u8>,
        result_hash: vector<u8>,
        status: u8,
        created_secs: u64,
        deadline_secs: u64,
        rated: bool,
    }

    struct Watch has store, copy, drop {
        id: u64,
        user: address,
        token: address,
        max_price: u64,
        max_slippage_bps: u64,
        max_spend: u64,
        expires: u64,
        active: bool,
    }

    struct FaucetStamp has key {
        next_secs: u64,
    }

    struct Registry has key {
        agents: vector<Agent>,
        jobs: vector<Job>,
        watches: vector<Watch>,
    }

    #[event]
    struct Hired has drop, store {
        job_id: u64,
        user: address,
        agent_id: u64,
        amount: u64,
    }

    #[event]
    struct Settled has drop, store {
        job_id: u64,
        status: u8,
        result_hash: vector<u8>,
    }

    fun init_module(publisher: &signer) {
        let (burn, freeze, mint) = coin::initialize<CLERK>(
            publisher,
            string::utf8(b"Clerk"),
            string::utf8(b"CLERK"),
            8,
            true,
        );
        coin::destroy_freeze_cap(freeze);
        coin::register<CLERK>(publisher);
        move_to(publisher, Caps { mint, burn });
        let admin = signer::address_of(publisher);
        move_to(publisher, Config {
            admin,
            treasury: admin,
            fee_bps: 0,
            review_secs: 172800,
            next_agent: 1,
            next_job: 1,
            next_watch: 1,
        });
        move_to(publisher, Treasury { coins: coin::zero<CLERK>(), fees: coin::zero<CLERK>() });
        move_to(publisher, Registry {
            agents: vector::empty(),
            jobs: vector::empty(),
            watches: vector::empty(),
        });
    }

    public entry fun mint_to(admin: &signer, to: address, amount: u64) acquires Caps, Config {
        assert!(signer::address_of(admin) == borrow_global<Config>(@clerk).admin, E_ADMIN);
        coin::deposit(to, coin::mint<CLERK>(amount, &borrow_global<Caps>(@clerk).mint));
    }

    /// Testnet drip. 500 CLERK, once an hour, into the signer's own account.
    public entry fun faucet(user: &signer) acquires Caps, FaucetStamp {
        let addr = signer::address_of(user);
        let now = timestamp::now_seconds();
        if (exists<FaucetStamp>(addr)) {
            let stamp = borrow_global_mut<FaucetStamp>(addr);
            assert!(now >= stamp.next_secs, E_FAUCET);
            stamp.next_secs = now + FAUCET_WAIT;
        } else {
            move_to(user, FaucetStamp { next_secs: now + FAUCET_WAIT });
        };
        if (!coin::is_account_registered<CLERK>(addr)) {
            coin::register<CLERK>(user);
        };
        coin::deposit(addr, coin::mint<CLERK>(FAUCET_DRIP, &borrow_global<Caps>(@clerk).mint));
    }

    public entry fun set_fee_bps(admin: &signer, fee_bps: u64) acquires Config {
        assert!(signer::address_of(admin) == borrow_global<Config>(@clerk).admin, E_ADMIN);
        assert!(fee_bps <= 1000, E_FEE);
        borrow_global_mut<Config>(@clerk).fee_bps = fee_bps;
    }

    public entry fun set_treasury(admin: &signer, treasury: address) acquires Config {
        assert!(signer::address_of(admin) == borrow_global<Config>(@clerk).admin, E_ADMIN);
        borrow_global_mut<Config>(@clerk).treasury = treasury;
    }

    public entry fun set_review_secs(admin: &signer, secs: u64) acquires Config {
        assert!(signer::address_of(admin) == borrow_global<Config>(@clerk).admin, E_ADMIN);
        assert!(secs >= 30 && secs <= 604800, E_FEE);
        borrow_global_mut<Config>(@clerk).review_secs = secs;
    }

    public entry fun register_agent(
        creator: &signer,
        name: vector<u8>,
        description: vector<u8>,
        category: vector<u8>,
        price: u64,
        input_type: vector<u8>,
        permissions: vector<u8>,
    ) acquires Config, Registry {
        let n = vector::length(&name);
        assert!(n > 0 && n <= 64, E_NAME);
        assert!(price > 0, E_PRICE);
        let id = borrow_global<Config>(@clerk).next_agent;
        borrow_global_mut<Config>(@clerk).next_agent = id + 1;
        vector::push_back(&mut borrow_global_mut<Registry>(@clerk).agents, Agent {
            id,
            creator: signer::address_of(creator),
            name: string::utf8(name),
            description: string::utf8(description),
            category: string::utf8(category),
            price,
            input_type: string::utf8(input_type),
            permissions: string::utf8(permissions),
            active: true,
            completed: 0,
            failed: 0,
            rating_sum: 0,
            rating_count: 0,
            volume: 0,
        });
    }

    public entry fun set_agent_price(creator: &signer, agent_id: u64, price: u64) acquires Registry {
        assert!(price > 0, E_PRICE);
        let agents = &mut borrow_global_mut<Registry>(@clerk).agents;
        let i = 0;
        let n = vector::length(agents);
        while (i < n) {
            let agent = vector::borrow_mut(agents, i);
            if (agent.id == agent_id) {
                assert!(agent.creator == signer::address_of(creator), E_AUTH);
                agent.price = price;
                return
            };
            i = i + 1;
        };
        abort E_AGENT
    }

    public entry fun set_agent_active(creator: &signer, agent_id: u64, active: bool) acquires Registry {
        let agents = &mut borrow_global_mut<Registry>(@clerk).agents;
        let i = 0;
        let n = vector::length(agents);
        while (i < n) {
            let agent = vector::borrow_mut(agents, i);
            if (agent.id == agent_id) {
                assert!(agent.creator == signer::address_of(creator), E_AUTH);
                agent.active = active;
                return
            };
            i = i + 1;
        };
        abort E_AGENT
    }

    public entry fun hire(user: &signer, agent_id: u64, input_hash: vector<u8>) acquires Config, Registry, Treasury {
        assert!(vector::length(&input_hash) == 32, E_HASH);
        let listing = copy_agent(agent_id);
        assert!(listing.active, E_AGENT);
        let paid = coin::withdraw<CLERK>(user, listing.price);
        coin::merge(&mut borrow_global_mut<Treasury>(@clerk).coins, paid);
        let now = timestamp::now_seconds();
        let fee_bps = borrow_global<Config>(@clerk).fee_bps;
        let review = borrow_global<Config>(@clerk).review_secs;
        let id = borrow_global<Config>(@clerk).next_job;
        borrow_global_mut<Config>(@clerk).next_job = id + 1;
        let payer = signer::address_of(user);
        vector::push_back(&mut borrow_global_mut<Registry>(@clerk).jobs, Job {
            id,
            user: payer,
            agent_id,
            amount: listing.price,
            fee: listing.price * fee_bps / 10000,
            input_hash,
            result_hash: vector::empty(),
            status: FUNDED,
            created_secs: now,
            deadline_secs: now + review,
            rated: false,
        });
        event::emit(Hired { job_id: id, user: payer, agent_id, amount: listing.price });
    }

    public entry fun complete(creator: &signer, job_id: u64, result_hash: vector<u8>) acquires Registry, Treasury {
        assert!(vector::length(&result_hash) == 32, E_HASH);
        let row = copy_job(job_id);
        assert!(row.status == FUNDED, E_STATUS);
        let listing = copy_agent(row.agent_id);
        assert!(listing.creator == signer::address_of(creator), E_AUTH);
        let payout = row.amount - row.fee;
        if (payout > 0) {
            coin::deposit(listing.creator, coin::extract(&mut borrow_global_mut<Treasury>(@clerk).coins, payout));
        };
        if (row.fee > 0) {
            let fee = coin::extract(&mut borrow_global_mut<Treasury>(@clerk).coins, row.fee);
            coin::merge(&mut borrow_global_mut<Treasury>(@clerk).fees, fee);
        };
        bump_agent(row.agent_id, true, row.amount);
        write_job(job_id, COMPLETED, result_hash);
        event::emit(Settled { job_id, status: COMPLETED, result_hash });
    }

    public entry fun fail(creator: &signer, job_id: u64) acquires Registry, Treasury {
        let row = copy_job(job_id);
        assert!(row.status == FUNDED, E_STATUS);
        let listing = copy_agent(row.agent_id);
        assert!(listing.creator == signer::address_of(creator), E_AUTH);
        coin::deposit(row.user, coin::extract(&mut borrow_global_mut<Treasury>(@clerk).coins, row.amount));
        bump_agent(row.agent_id, false, 0);
        write_job(job_id, FAILED, vector::empty());
        event::emit(Settled { job_id, status: FAILED, result_hash: vector::empty() });
    }

    public entry fun refund(user: &signer, job_id: u64) acquires Registry, Treasury {
        let row = copy_job(job_id);
        assert!(row.user == signer::address_of(user), E_AUTH);
        assert!(row.status == FUNDED, E_STATUS);
        assert!(timestamp::now_seconds() >= row.deadline_secs, E_STATUS);
        pay_back(row.user, row.amount);
        write_job(job_id, REFUNDED, vector::empty());
        event::emit(Settled { job_id, status: REFUNDED, result_hash: vector::empty() });
    }

    /// Returns immediately when the job is missing, finished, or not yet due.
    /// Not registered with Automation until gas is measured on the target network.
    public entry fun settle_expired(job_id: u64) acquires Registry, Treasury {
        if (!job_exists(job_id)) return;
        let row = copy_job(job_id);
        if (row.status != FUNDED) return;
        if (timestamp::now_seconds() < row.deadline_secs) return;
        pay_back(row.user, row.amount);
        write_job(job_id, REFUNDED, vector::empty());
        event::emit(Settled { job_id, status: REFUNDED, result_hash: vector::empty() });
    }

    public entry fun rate(user: &signer, job_id: u64, score: u64) acquires Registry {
        assert!(score >= 1 && score <= 5, E_RATING);
        let row = copy_job(job_id);
        assert!(row.user == signer::address_of(user), E_AUTH);
        assert!(row.status == COMPLETED, E_STATUS);
        assert!(!row.rated, E_RATING);
        let jobs = &mut borrow_global_mut<Registry>(@clerk).jobs;
        let i = 0;
        while (i < vector::length(jobs)) {
            let job = vector::borrow_mut(jobs, i);
            if (job.id == job_id) {
                job.rated = true;
                break
            };
            i = i + 1;
        };
        let agents = &mut borrow_global_mut<Registry>(@clerk).agents;
        i = 0;
        while (i < vector::length(agents)) {
            let agent = vector::borrow_mut(agents, i);
            if (agent.id == row.agent_id) {
                agent.rating_sum = agent.rating_sum + score;
                agent.rating_count = agent.rating_count + 1;
                return
            };
            i = i + 1;
        };
        abort E_AGENT
    }

    /// A limit the user recorded. It does not move coins and it does not call a DEX.
    public entry fun register_watch(
        user: &signer,
        token: address,
        max_price: u64,
        max_slippage_bps: u64,
        max_spend: u64,
        expires: u64,
    ) acquires Config, Registry {
        assert!(max_slippage_bps <= 1000, E_FEE);
        assert!(max_spend > 0, E_PRICE);
        let id = borrow_global<Config>(@clerk).next_watch;
        borrow_global_mut<Config>(@clerk).next_watch = id + 1;
        vector::push_back(&mut borrow_global_mut<Registry>(@clerk).watches, Watch {
            id,
            user: signer::address_of(user),
            token,
            max_price,
            max_slippage_bps,
            max_spend,
            expires,
            active: true,
        });
    }

    public entry fun cancel_watch(user: &signer, watch_id: u64) acquires Registry {
        let watches = &mut borrow_global_mut<Registry>(@clerk).watches;
        let i = 0;
        let n = vector::length(watches);
        while (i < n) {
            let watch = vector::borrow_mut(watches, i);
            if (watch.id == watch_id) {
                assert!(watch.user == signer::address_of(user), E_AUTH);
                watch.active = false;
                return
            };
            i = i + 1;
        };
        abort E_JOB
    }

    fun pay_back(user: address, amount: u64) acquires Treasury {
        coin::deposit(user, coin::extract(&mut borrow_global_mut<Treasury>(@clerk).coins, amount));
    }

    fun bump_agent(agent_id: u64, ok: bool, volume: u64) acquires Registry {
        let agents = &mut borrow_global_mut<Registry>(@clerk).agents;
        let i = 0;
        while (i < vector::length(agents)) {
            let agent = vector::borrow_mut(agents, i);
            if (agent.id == agent_id) {
                if (ok) {
                    agent.completed = agent.completed + 1;
                    agent.volume = agent.volume + volume;
                } else {
                    agent.failed = agent.failed + 1;
                };
                return
            };
            i = i + 1;
        };
        abort E_AGENT
    }

    fun write_job(job_id: u64, status: u8, result_hash: vector<u8>) acquires Registry {
        let jobs = &mut borrow_global_mut<Registry>(@clerk).jobs;
        let i = 0;
        while (i < vector::length(jobs)) {
            let job = vector::borrow_mut(jobs, i);
            if (job.id == job_id) {
                job.status = status;
                job.result_hash = result_hash;
                return
            };
            i = i + 1;
        };
        abort E_JOB
    }

    fun copy_agent(agent_id: u64): Agent acquires Registry {
        let agents = &borrow_global<Registry>(@clerk).agents;
        let i = 0;
        while (i < vector::length(agents)) {
            let agent = vector::borrow(agents, i);
            if (agent.id == agent_id) return *agent;
            i = i + 1;
        };
        abort E_AGENT
    }

    fun copy_job(job_id: u64): Job acquires Registry {
        let jobs = &borrow_global<Registry>(@clerk).jobs;
        let i = 0;
        while (i < vector::length(jobs)) {
            let job = vector::borrow(jobs, i);
            if (job.id == job_id) return *job;
            i = i + 1;
        };
        abort E_JOB
    }

    fun job_exists(job_id: u64): bool acquires Registry {
        let jobs = &borrow_global<Registry>(@clerk).jobs;
        let i = 0;
        while (i < vector::length(jobs)) {
            if (vector::borrow(jobs, i).id == job_id) return true;
            i = i + 1;
        };
        false
    }

    #[view]
    public fun agent_count(): u64 acquires Registry {
        vector::length(&borrow_global<Registry>(@clerk).agents)
    }

    #[view]
    public fun job_count(): u64 acquires Registry {
        vector::length(&borrow_global<Registry>(@clerk).jobs)
    }

    #[view]
    public fun job_status(job_id: u64): u8 acquires Registry {
        copy_job(job_id).status
    }

    #[test_only]
    use supra_framework::account;
    #[test_only]
    use supra_framework::timestamp::Self as ts;

    #[test_only]
    fun start(secs: u64) {
        let framework = account::create_account_for_test(@0x1);
        ts::set_time_has_started_for_testing(&framework);
        if (secs > 0) ts::update_global_time_for_test_secs(secs);
        let publisher = account::create_account_for_test(@clerk);
        init_module(&publisher);
    }

    #[test_only]
    fun hash32(): vector<u8> {
        let bytes = vector::empty<u8>();
        let i = 0;
        while (i < 32) {
            vector::push_back(&mut bytes, 1);
            i = i + 1;
        };
        bytes
    }

    #[test]
    fun hire_and_complete() acquires Caps, Config, Registry, Treasury {
        start(1_000);
        let publisher = account::create_account_for_test(@clerk);
        let user = account::create_account_for_test(@0xB0B);
        coin::register<CLERK>(&user);
        mint_to(&publisher, @0xB0B, 50_000_000_00);
        register_agent(&publisher, b"Wallet Detective", b"reads", b"Research", 50_000_000_00, b"supra-address", b"READ ONLY");
        hire(&user, 1, hash32());
        assert!(job_status(1) == FUNDED, 0);
        complete(&publisher, 1, hash32());
        assert!(job_status(1) == COMPLETED, 0);
        assert!(coin::balance<CLERK>(@clerk) == 50_000_000_00, 0);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = clerk::market)]
    fun cannot_complete_twice() acquires Caps, Config, Registry, Treasury {
        start(1_000);
        let publisher = account::create_account_for_test(@clerk);
        let user = account::create_account_for_test(@0xB0B);
        coin::register<CLERK>(&user);
        mint_to(&publisher, @0xB0B, 50_000_000_00);
        register_agent(&publisher, b"Wallet Detective", b"reads", b"Research", 50_000_000_00, b"supra-address", b"READ ONLY");
        hire(&user, 1, hash32());
        complete(&publisher, 1, hash32());
        complete(&publisher, 1, hash32());
    }

    #[test]
    #[expected_failure(abort_code = 6, location = clerk::market)]
    fun stranger_cannot_complete() acquires Caps, Config, Registry, Treasury {
        start(1_000);
        let publisher = account::create_account_for_test(@clerk);
        let user = account::create_account_for_test(@0xB0B);
        let stranger = account::create_account_for_test(@0xBAD);
        coin::register<CLERK>(&user);
        mint_to(&publisher, @0xB0B, 50_000_000_00);
        register_agent(&publisher, b"Wallet Detective", b"reads", b"Research", 50_000_000_00, b"supra-address", b"READ ONLY");
        hire(&user, 1, hash32());
        complete(&stranger, 1, hash32());
    }

    #[test]
    fun fail_returns_the_escrow() acquires Caps, Config, Registry, Treasury {
        start(1_000);
        let publisher = account::create_account_for_test(@clerk);
        let user = account::create_account_for_test(@0xB0B);
        coin::register<CLERK>(&user);
        mint_to(&publisher, @0xB0B, 100_000_000_00);
        register_agent(&publisher, b"Risk", b"reads", b"Research", 100_000_000_00, b"package-module", b"READ ONLY");
        hire(&user, 1, hash32());
        fail(&publisher, 1);
        assert!(coin::balance<CLERK>(@0xB0B) == 100_000_000_00, 0);
    }

    #[test]
    fun refund_after_deadline() acquires Caps, Config, Registry, Treasury {
        start(1_000);
        let publisher = account::create_account_for_test(@clerk);
        let user = account::create_account_for_test(@0xB0B);
        coin::register<CLERK>(&user);
        mint_to(&publisher, @0xB0B, 50_000_000_00);
        register_agent(&publisher, b"Wallet Detective", b"reads", b"Research", 50_000_000_00, b"supra-address", b"READ ONLY");
        hire(&user, 1, hash32());
        ts::fast_forward_seconds(172800);
        refund(&user, 1);
        assert!(coin::balance<CLERK>(@0xB0B) == 50_000_000_00, 0);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = clerk::market)]
    fun refund_is_early() acquires Caps, Config, Registry, Treasury {
        start(1_000);
        let publisher = account::create_account_for_test(@clerk);
        let user = account::create_account_for_test(@0xB0B);
        coin::register<CLERK>(&user);
        mint_to(&publisher, @0xB0B, 50_000_000_00);
        register_agent(&publisher, b"Wallet Detective", b"reads", b"Research", 50_000_000_00, b"supra-address", b"READ ONLY");
        hire(&user, 1, hash32());
        refund(&user, 1);
    }

    #[test]
    fun faucet_registers_and_drips() acquires Caps, FaucetStamp {
        start(1_000);
        let user = account::create_account_for_test(@0xB0B);
        faucet(&user);
        assert!(coin::balance<CLERK>(@0xB0B) == 500_0000_0000, 0);
    }

    #[test]
    #[expected_failure(abort_code = 11, location = clerk::market)]
    fun faucet_waits_an_hour() acquires Caps, FaucetStamp {
        start(1_000);
        let user = account::create_account_for_test(@0xB0B);
        faucet(&user);
        faucet(&user);
    }
}
