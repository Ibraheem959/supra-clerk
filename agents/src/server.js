import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { createChain } from "./chain.js";
import { createLedger } from "./rules.js";
import { investigateWallet } from "./agents/detective.js";
import { researchProject } from "./agents/research.js";
import { reviewContract } from "./agents/risk.js";
import { writeContent } from "./agents/content.js";
import { scanWallet } from "./agents/cleaner.js";
import { tradePreview } from "./agents/trader.js";
import { readPortfolio } from "./agents/portfolio.js";
import { normalizeAddress } from "./address.js";

const ledger = createLedger(() => Math.floor(Date.now() / 1000));
const results = new Map();
const chain = createChain();
const operator = (process.env.CLERK_OPERATOR || ledger.admin).toLowerCase();
ledger.assignPlatform(operator);

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function publicAgent(agent) {
  const rating = agent.ratingCount ? agent.ratingSum / agent.ratingCount : null;
  const done = agent.completed + agent.failed;
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    category: agent.category,
    price: agent.price.toString(),
    inputType: agent.inputType,
    permissions: agent.permissions,
    active: agent.active,
    creator: agent.creator,
    completed: agent.completed,
    failed: agent.failed,
    rating,
    successRate: done ? agent.completed / done : null,
    volume: agent.volume.toString(),
  };
}

function publicJob(job) {
  return {
    id: job.id,
    user: job.user,
    agentId: job.agentId,
    amount: job.amount.toString(),
    status: job.status,
    createdSecs: job.createdSecs,
    deadlineSecs: job.deadlineSecs,
    resultHash: job.resultHash,
    rated: job.rated,
  };
}

async function runAgent(agent, input, prior) {
  if (agent.name === "Wallet Detective") return investigateWallet(chain, input);
  if (agent.name === "Project Research") return researchProject(chain, input);
  if (agent.name === "Contract Risk") return reviewContract(chain, input);
  if (agent.name === "Content") return writeContent(prior);
  if (agent.name === "Wallet Cleaner") return scanWallet(chain, input, []);
  if (agent.name === "Trading") return tradePreview({ pay: input, receive: "token", slippageBps: 100, quotes: unverifiedQuotes() });
  if (agent.name === "Portfolio") return readPortfolio(chain, input);
  return {
    title: agent.name,
    subject: "custom",
    claims: [{ label: "DATA", claim: "This registered agent has no executor in this process.", evidence: agent.permissions }],
    unavailable: ["A third-party endpoint was not called. Clerk does not run arbitrary URLs."],
  };
}

function unverifiedQuotes() {
  return [
    { venue: "atmos", status: "not_verified", reason: "official entry not pinned" },
    { venue: "dexlyn", status: "not_verified", reason: "official entry not pinned" },
    { venue: "wars", status: "not_verified", reason: "official entry not pinned" },
  ];
}

async function handle(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") return send(res, 204, {});
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, {
        name: "Clerk",
        mode: "memory",
        live: false,
        network: process.env.SUPRA_NETWORK || "mainnet",
        chainId: process.env.SUPRA_NETWORK === "testnet" ? 6 : process.env.SUPRA_NETWORK === "devnet" ? 50 : 8,
        rpc: chain.rpc,
        market: process.env.CLERK_MARKET_ADDRESS || "",
        note: "Job escrow in this process is a local ledger. Chain reads for reports use the Supra RPC. The market module is not published.",
      });
    }
    if (req.method === "GET" && url.pathname === "/api/agents") {
      return send(res, 200, ledger.agents().map(publicAgent));
    }
    if (req.method === "POST" && url.pathname === "/api/agents") {
      const body = await jsonBody(req);
      const created = ledger.registerAgent(body.creator, {
        name: body.name,
        description: body.description,
        category: body.category,
        price: BigInt(body.price),
        inputType: body.inputType,
        permissions: body.permissions,
      });
      return send(res, 201, publicAgent(created));
    }
    if (req.method === "GET" && url.pathname === "/api/jobs") {
      const user = url.searchParams.get("user");
      const rows = ledger.jobs().filter((item) => !user || item.user === user.toLowerCase());
      return send(res, 200, rows.map(publicJob));
    }
    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const body = await jsonBody(req);
      const user = normalizeAddress(body.user);
      const input = String(body.input ?? "");
      const created = ledger.hire(user, Number(body.agentId), hashText(input));
      const secret = randomBytes(16).toString("hex");
      results.set(created.id, { secret, input, report: null });
      return send(res, 201, { ...publicJob(created), secret });
    }
    const jobRun = url.pathname.match(/^\/api\/jobs\/(\d+)\/run$/);
    if (req.method === "POST" && jobRun) {
      const id = Number(jobRun[1]);
      const body = await jsonBody(req);
      const row = ledger.jobs().find((item) => item.id === id);
      const stored = results.get(id);
      if (!row || !stored || body.secret !== stored.secret) return send(res, 403, { error: "unauthorized" });
      if (row.status !== "FUNDED") return send(res, 409, { error: "status" });
      const agent = ledger.agents().find((item) => item.id === row.agentId);
      const report = await runAgent(agent, stored.input);
      stored.report = report;
      const resultHash = hashText(JSON.stringify(report));
      ledger.complete(agent.creator, id, resultHash);
      return send(res, 200, { job: publicJob(ledger.jobs().find((item) => item.id === id)), report });
    }
    const jobRead = url.pathname.match(/^\/api\/jobs\/(\d+)$/);
    if (req.method === "GET" && jobRead) {
      const id = Number(jobRead[1]);
      const row = ledger.jobs().find((item) => item.id === id);
      if (!row) return send(res, 404, { error: "invalid job" });
      const stored = results.get(id);
      const secret = url.searchParams.get("secret");
      const report = stored && secret === stored.secret ? stored.report : null;
      return send(res, 200, { job: publicJob(row), report });
    }
    const jobRate = url.pathname.match(/^\/api\/jobs\/(\d+)\/rate$/);
    if (req.method === "POST" && jobRate) {
      const body = await jsonBody(req);
      ledger.rate(body.user, Number(jobRate[1]), Number(body.score));
      return send(res, 200, { ok: true });
    }
    const jobFail = url.pathname.match(/^\/api\/jobs\/(\d+)\/fail$/);
    if (req.method === "POST" && jobFail) {
      const body = await jsonBody(req);
      return send(res, 200, publicJob(ledger.fail(body.creator, Number(jobFail[1]))));
    }
    const jobRefund = url.pathname.match(/^\/api\/jobs\/(\d+)\/refund$/);
    if (req.method === "POST" && jobRefund) {
      const body = await jsonBody(req);
      return send(res, 200, publicJob(ledger.refund(body.user, Number(jobRefund[1]))));
    }
    if (req.method === "POST" && url.pathname === "/api/faucet") {
      const body = await jsonBody(req);
      const user = normalizeAddress(body.user);
      ledger.credit(user, 1000n * 100_000_000n);
      return send(res, 200, { balance: ledger.balance(user).toString() });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/balance/")) {
      const user = normalizeAddress(decodeURIComponent(url.pathname.split("/").pop()));
      return send(res, 200, { balance: ledger.balance(user).toString(), supra: (await chain.supraBalance(user).catch(() => null))?.toString() ?? null });
    }
    if (req.method === "POST" && url.pathname === "/api/trade/preview") {
      const body = await jsonBody(req);
      return send(res, 200, tradePreview({ pay: body.pay, receive: body.receive, slippageBps: Number(body.slippageBps || 100), quotes: unverifiedQuotes() }));
    }
    if (req.method === "POST" && url.pathname === "/api/cleaner/scan") {
      const body = await jsonBody(req);
      return send(res, 200, await scanWallet(chain, body.address, []));
    }
    return send(res, 404, { error: "not found" });
  } catch (error) {
    return send(res, 400, { error: error instanceof Error ? error.message : "rejected" });
  }
}

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function start(port = Number(process.env.PORT || 8787)) {
  const server = createServer((req, res) => { void handle(req, res); });
  server.listen(port);
  return server;
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) start();
