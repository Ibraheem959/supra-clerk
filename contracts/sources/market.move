/// Clerk marketplace. CLERK is only spent to hire an agent.
/// There is no stake, no emission, and no public mint.
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

    /// A permission the user recorded. It does not spend coins and it does not call a DEX.
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
        move_to(publisher, Treasury {
            coins: coin::zero<CLERK>(),
            fees: coin::zero<CLERK>(),
        });
        move_to(publisher, Registry {
            agents: vector::empty(),
            jobs: vector::empty(),
            watches: vector::empty(),
        });
    }

    fun config_mut(): &mut Config acquires Config {
        borrow_global_mut<Config>(@clerk)
    }

    fun assert_admin(account: &signer) acquires Config {
        assert!(signer::address_of(account) == borrow_global<Config>(@clerk).admin, E_ADMIN);
    }

    public entry fun mint_to(admin: &signer, to: address, amount: u64) acquires Caps, Config {
        assert_admin(admin);
        let coins = coin::mint<CLERK>(amount, &borrow_global<Caps>(@clerk).mint);
        coin::deposit(to, coins);
    }

    public entry fun set_fee_bps(admin: &signer, fee_bps: u64) acquires Config {
        assert_admin(admin);
        assert!(fee_bps <= 1000, E_FEE);
        config_mut().fee_bps = fee_bps;
    }

    public entry fun set_treasury(admin: &signer, treasury: address) acquires Config {
        assert_admin(admin);
        config_mut().treasury = treasury;
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
        let cfg = config_mut();
        let id = cfg.next_agent;
        cfg.next_agent = id + 1;
        let registry = borrow_global_mut<Registry>(@clerk);
        vector::push_back(&mut registry.agents, Agent {
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
        let agent = find_agent_mut(agent_id);
        assert!(agent.creator == signer::address_of(creator), E_AUTH);
        agent.price = price;
    }

    public entry fun set_agent_active(creator: &signer, agent_id: u64, active: bool) acquires Registry {
        let agent = find_agent_mut(agent_id);
        assert!(agent.creator == signer::address_of(creator), E_AUTH);
        agent.active = active;
    }

    public entry fun hire(user: &signer, agent_id: u64, input_hash: vector<u8>) acquires Config, Registry, Treasury {
        assert!(vector::length(&input_hash) == 32, E_HASH);
        let agent = find_agent(agent_id);
        assert!(agent.active, E_AGENT);
        let amount = agent.price;
        let paid = coin::withdraw<CLERK>(user, amount);
        coin::merge(&mut borrow_global_mut<Treasury>(@clerk).coins, paid);
        let cfg = config_mut();
        let id = cfg.next_job;
        cfg.next_job = id + 1;
        let now = timestamp::now_seconds();
        let fee = amount * cfg.fee_bps / 10000;
        let job = Job {
            id,
            user: signer::address_of(user),
            agent_id,
            amount,
            fee,
            input_hash,
            result_hash: vector::empty(),
            status: FUNDED,
            created_secs: now,
            deadline_secs: now + cfg.review_secs,
            rated: false,
        };
        vector::push_back(&mut borrow_global_mut<Registry>(@clerk).jobs, job);
        event::emit(Hired { job_id: id, user: signer::address_of(user), agent_id, amount });
    }

    public entry fun complete(creator: &signer, job_id: u64, result_hash: vector<u8>) acquires Config, Registry, Treasury {
        assert!(vector::length(&result_hash) == 32, E_HASH);
        settle(creator, job_id, COMPLETED, result_hash);
    }

    public entry fun fail(creator: &signer, job_id: u64) acquires Config, Registry, Treasury {
        settle(creator, job_id, FAILED, vector::empty());
    }

    public entry fun refund(user: &signer, job_id: u64) acquires Registry, Treasury {
        let job = find_job_mut(job_id);
        assert!(job.user == signer::address_of(user), E_AUTH);
        assert!(job.status == FUNDED, E_STATUS);
        assert!(timestamp::now_seconds() >= job.deadline_secs, E_STATUS);
        refund_job(job);
    }

    /// No-op until the deadline. Safe to call; it does not abort when the job is not ready.
    /// Not registered with Automation in this repository. A global scan spends gas every block.
    public entry fun settle_expired(job_id: u64) acquires Registry, Treasury {
        if (!exists_job(job_id)) return;
        let job = find_job_mut(job_id);
        if (job.status != FUNDED) return;
        if (timestamp::now_seconds() < job.deadline_secs) return;
        refund_job(job);
    }

    public entry fun rate(user: &signer, job_id: u64, score: u64) acquires Registry {
        assert!(score >= 1 && score <= 5, E_RATING);
        let job = find_job_mut(job_id);
        assert!(job.user == signer::address_of(user), E_AUTH);
        assert!(job.status == COMPLETED, E_STATUS);
        assert!(!job.rated, E_RATING);
        job.rated = true;
        let agent = find_agent_mut(job.agent_id);
        agent.rating_sum = agent.rating_sum + score;
        agent.rating_count = agent.rating_count + 1;
    }

    /// Records a limit. Does not transfer CLERK and does not call Atmos, Dexlyn, or WARs.
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
        let cfg = config_mut();
        let id = cfg.next_watch;
        cfg.next_watch = id + 1;
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
        assert!(false, E_JOB);
    }

    fun settle(creator: &signer, job_id: u64, status: u8, result_hash: vector<u8>) acquires Registry, Treasury {
        let (user_addr, agent_id, amount, fee) = job_facts(job_id);
        let creator_addr = agent_creator(agent_id);
        assert!(creator_addr == signer::address_of(creator), E_AUTH);
        if (status == COMPLETED) {
            let treasury = borrow_global_mut<Treasury>(@clerk);
            let payout = amount - fee;
            if (payout > 0) coin::deposit(creator_addr, coin::extract(&mut treasury.coins, payout));
            if (fee > 0) coin::merge(&mut treasury.fees, coin::extract(&mut treasury.coins, fee));
            let agent = find_agent_mut(agent_id);
            agent.completed = agent.completed + 1;
            agent.volume = agent.volume + amount;
            let job = find_job_mut(job_id);
            job.result_hash = result_hash;
            job.status = COMPLETED;
        } else {
            coin::deposit(user_addr, coin::extract(&mut borrow_global_mut<Treasury>(@clerk).coins, amount));
            let agent = find_agent_mut(agent_id);
            agent.failed = agent.failed + 1;
            let job = find_job_mut(job_id);
            job.status = FAILED;
        };
        event::emit(Settled { job_id, status, result_hash });
    }

    fun job_facts(job_id: u64): (address, u64, u64, u64) acquires Registry {
        let job = find_job_mut(job_id);
        assert!(job.status == FUNDED, E_STATUS);
        (job.user, job.agent_id, job.amount, job.fee)
    }

    fun agent_creator(agent_id: u64): address acquires Registry {
        find_agent(agent_id).creator
    }

    fun refund_job(job: &mut Job) acquires Treasury {
        coin::deposit(job.user, coin::extract(&mut borrow_global_mut<Treasury>(@clerk).coins, job.amount));
        job.status = REFUNDED;
        event::emit(Settled { job_id: job.id, status: REFUNDED, result_hash: vector::empty() });
    }

    fun find_agent(agent_id: u64): Agent acquires Registry {
        let agents = &borrow_global<Registry>(@clerk).agents;
        let i = 0;
        let n = vector::length(agents);
        while (i < n) {
            let agent = vector::borrow(agents, i);
            if (agent.id == agent_id) return *agent;
            i = i + 1;
        };
        abort E_AGENT
    }

    fun find_agent_mut(agent_id: u64): &mut Agent acquires Registry {
        let agents = &mut borrow_global_mut<Registry>(@clerk).agents;
        let i = 0;
        let n = vector::length(agents);
        while (i < n) {
            let agent = vector::borrow_mut(agents, i);
            if (agent.id == agent_id) return agent;
            i = i + 1;
        };
        abort E_AGENT
    }

    fun exists_job(job_id: u64): bool acquires Registry {
        let jobs = &borrow_global<Registry>(@clerk).jobs;
        let i = 0;
        let n = vector::length(jobs);
        while (i < n) {
            if (vector::borrow(jobs, i).id == job_id) return true;
            i = i + 1;
        };
        false
    }

    fun find_job_mut(job_id: u64): &mut Job acquires Registry {
        let jobs = &mut borrow_global_mut<Registry>(@clerk).jobs;
        let i = 0;
        let n = vector::length(jobs);
        while (i < n) {
            let job = vector::borrow_mut(jobs, i);
            if (job.id == job_id) return job;
            i = i + 1;
        };
        abort E_JOB
    }

    #[view]
    public fun agent_count(): u64 acquires Registry {
        vector::length(&borrow_global<Registry>(@clerk).agents)
    }

    #[view]
    public fun job_count(): u64 acquires Registry {
        vector::length(&borrow_global<Registry>(@clerk).jobs)
    }
}
