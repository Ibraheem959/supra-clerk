export const FUNDED = "FUNDED";
export const COMPLETED = "COMPLETED";
export const FAILED = "FAILED";
export const REFUNDED = "REFUNDED";

export const UNIT = 100_000_000n;

export function clerk(whole) {
  return BigInt(whole) * UNIT;
}

const SEED = [
  ["Wallet Detective", "Reads a Supra account and attaches a transaction to every factual claim.", "Research", 50, "supra-address", "READ ONLY. Cannot move funds."],
  ["Project Research", "Reads a package or token account and reports only what the node returned.", "Research", 150, "supra-address", "READ ONLY. Cannot move funds."],
  ["Contract Risk", "Lists privileged entry functions found in the published module ABI.", "Research", 100, "package-module", "READ ONLY. Cannot move funds."],
  ["Content", "Turns a finished Clerk report into posts. It cannot add numbers that are not in the report.", "Content", 40, "report", "READ ONLY. Cannot move funds."],
  ["Wallet Cleaner", "Lists assets and offers a burn only when a redemption function is on the verified list.", "Wallet", 80, "supra-address", "WRITE only after you approve each asset. No blanket burn."],
  ["Trading", "Compares venues that returned a real quote. It never signs a swap.", "Trading", 60, "trade-intent", "WRITE only the transaction you approve. No key is held here."],
  ["Portfolio", "Reads coin balances the node still stores on the account.", "Research", 70, "supra-address", "READ ONLY. Suggestions are not trades."],
];

export function seedAgents() {
  return SEED.map((row, index) => ({
    id: index + 1,
    creator: "0x" + "1".repeat(64),
    name: row[0],
    description: row[1],
    category: row[2],
    price: clerk(row[3]),
    inputType: row[4],
    permissions: row[5],
    active: true,
    completed: 0,
    failed: 0,
    ratingSum: 0,
    ratingCount: 0,
    volume: 0n,
  }));
}

export function createLedger(now = () => 0) {
  const agents = seedAgents();
  const jobs = [];
  const watches = [];
  const balances = new Map();
  const treasury = { escrow: 0n, fees: 0n };
  let feeBps = 0;
  let reviewSecs = 172800;
  let nextJob = 1;
  let nextWatch = 1;
  const admin = "0x" + "a".repeat(64);

  function credit(address, amount) {
    const key = normalize(address);
    balances.set(key, (balances.get(key) ?? 0n) + amount);
  }

  function debit(address, amount) {
    const key = normalize(address);
    const have = balances.get(key) ?? 0n;
    if (have < amount) throw new Error("insufficient CLERK");
    balances.set(key, have - amount);
  }

  function agent(id) {
    const found = agents.find((item) => item.id === id);
    if (!found) throw new Error("invalid agent");
    return found;
  }

  function job(id) {
    const found = jobs.find((item) => item.id === id);
    if (!found) throw new Error("invalid job");
    return found;
  }

  function normalize(address) {
    return address.toLowerCase();
  }

  return {
    admin,
    assignPlatform(address) {
      const creator = normalize(address);
      for (const item of agents) item.creator = creator;
    },
    credit,
    balance: (address) => balances.get(normalize(address)) ?? 0n,
    setFeeBps(caller, bps) {
      if (normalize(caller) !== admin) throw new Error("unauthorized");
      if (bps < 0 || bps > 1000) throw new Error("fee");
      feeBps = bps;
    },
    feeBps: () => feeBps,
    registerAgent(creator, fields) {
      if (!fields.name || fields.name.length > 64) throw new Error("name");
      if (fields.price <= 0n) throw new Error("price");
      const created = {
        id: agents.length + 1,
        creator: normalize(creator),
        name: fields.name,
        description: fields.description ?? "",
        category: fields.category ?? "Custom",
        price: fields.price,
        inputType: fields.inputType ?? "text",
        permissions: fields.permissions ?? "READ ONLY",
        active: true,
        completed: 0,
        failed: 0,
        ratingSum: 0,
        ratingCount: 0,
        volume: 0n,
      };
      agents.push(created);
      return created;
    },
    setPrice(creator, agentId, price) {
      const row = agent(agentId);
      if (row.creator !== normalize(creator)) throw new Error("unauthorized");
      if (price <= 0n) throw new Error("price");
      row.price = price;
    },
    agents: () => agents.map((item) => ({ ...item })),
    jobs: () => jobs.map((item) => ({ ...item })),
    hire(user, agentId, inputHash, at = now()) {
      if (!/^[0-9a-f]{64}$/.test(inputHash)) throw new Error("hash");
      const row = agent(agentId);
      if (!row.active) throw new Error("invalid agent");
      debit(user, row.price);
      treasury.escrow += row.price;
      const created = {
        id: nextJob,
        user: normalize(user),
        agentId,
        amount: row.price,
        fee: (row.price * BigInt(feeBps)) / 10000n,
        inputHash,
        resultHash: "",
        status: FUNDED,
        createdSecs: at,
        deadlineSecs: at + reviewSecs,
        rated: false,
      };
      nextJob += 1;
      jobs.push(created);
      return { ...created };
    },
    complete(creator, jobId, resultHash) {
      if (!/^[0-9a-f]{64}$/.test(resultHash)) throw new Error("hash");
      const row = job(jobId);
      const owner = agent(row.agentId);
      if (row.status !== FUNDED) throw new Error("status");
      if (owner.creator !== normalize(creator)) throw new Error("unauthorized");
      const payout = row.amount - row.fee;
      treasury.escrow -= row.amount;
      if (payout > 0n) credit(owner.creator, payout);
      treasury.fees += row.fee;
      owner.completed += 1;
      owner.volume += row.amount;
      row.status = COMPLETED;
      row.resultHash = resultHash;
      return { ...row };
    },
    fail(creator, jobId) {
      const row = job(jobId);
      const owner = agent(row.agentId);
      if (row.status !== FUNDED) throw new Error("status");
      if (owner.creator !== normalize(creator)) throw new Error("unauthorized");
      treasury.escrow -= row.amount;
      credit(row.user, row.amount);
      owner.failed += 1;
      row.status = FAILED;
      return { ...row };
    },
    refund(user, jobId, at = now()) {
      const row = job(jobId);
      if (row.user !== normalize(user)) throw new Error("unauthorized");
      if (row.status !== FUNDED) throw new Error("status");
      if (at < row.deadlineSecs) throw new Error("early");
      treasury.escrow -= row.amount;
      credit(row.user, row.amount);
      row.status = REFUNDED;
      return { ...row };
    },
    settleExpired(jobId, at = now()) {
      const row = jobs.find((item) => item.id === jobId);
      if (!row || row.status !== FUNDED || at < row.deadlineSecs) return null;
      treasury.escrow -= row.amount;
      credit(row.user, row.amount);
      row.status = REFUNDED;
      return { ...row };
    },
    rate(user, jobId, score) {
      if (score < 1 || score > 5) throw new Error("rating");
      const row = job(jobId);
      if (row.user !== normalize(user)) throw new Error("unauthorized");
      if (row.status !== COMPLETED) throw new Error("status");
      if (row.rated) throw new Error("rating");
      row.rated = true;
      const owner = agent(row.agentId);
      owner.ratingSum += score;
      owner.ratingCount += 1;
    },
    registerWatch(user, fields) {
      if (fields.maxSlippageBps > 1000) throw new Error("fee");
      if (fields.maxSpend <= 0n) throw new Error("price");
      const created = { id: nextWatch, user: normalize(user), active: true, ...fields };
      nextWatch += 1;
      watches.push(created);
      return created;
    },
    watches: () => watches.map((item) => ({ ...item })),
    treasury: () => ({ ...treasury }),
  };
}
