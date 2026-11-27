import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createChain, supraRpc, chainIdFor } from "./chain.js";
import { clerkBalance, marketAddress, readDesk, verifyHire } from "./market.js";
import { createLedger } from "./rules.js";
import { investigateWallet } from "./agents/detective.js";
import { researchProject } from "./agents/research.js";
import { reviewContract } from "./agents/risk.js";
import { writeContent, writeAbout } from "./agents/content.js";
import { scanWallet } from "./agents/cleaner.js";
import { discoveredVenues, parseIntent, tradePreview } from "./agents/trader.js";
import { readPortfolio } from "./agents/portfolio.js";
import { prepareCall } from "./tx.js";
import { normalizeAddress } from "./address.js";

const webRoot = resolve(fileURLToPath(new URL("../../frontend/dist/", import.meta.url)));
const ledger = createLedger(() => Math.floor(Date.now() / 1000));
const results = new Map();
const storePath = resolve(fileURLToPath(new URL("../data/results.json", import.meta.url)));
try {
  const saved = JSON.parse(readFileSync(storePath, "utf8"));
  for (const [id, value] of Object.entries(saved)) results.set(Number(id), value);
} catch { /* a fresh desk has no saved results */ }

function remember(id, value) {
  results.set(id, value);
  try {
    mkdirSync(resolve(storePath, ".."), { recursive: true });
    const saved = {};
    for (const [key, row] of results) saved[key] = row;
    writeFileSync(storePath, JSON.stringify(saved));
  } catch { /* the result is still in memory for this process */ }
}
const reportChain = createChain(supraRpc(process.env.SUPRA_NETWORK || "mainnet"));
const deskChain = createChain("https://rpc-testnet.supra.com");
const market = marketAddress();
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

async function runAgent(agent, input, sender) {
  const chain = market ? deskChain : reportChain;
  if (agent.name === "Wallet Detective") return investigateWallet(chain, input);
  if (agent.name === "Project Research") return researchProject(chain, input || sender);
  if (agent.name === "Contract Risk") return reviewContract(chain, input || sender);
  if (agent.name === "Content") {
    if (/0x[0-9a-fA-F]{8,}/.test(String(input || "")) || sender) return writeAbout(chain, input, sender);
    return writeContent(null);
  }
  if (agent.name === "Wallet Cleaner") return scanWallet(chain, input || sender, []);
  if (agent.name === "Trading") {
    const intent = parseIntent(input);
    return tradePreview({ ...intent, slippageBps: 100, quotes: discoveredVenues() });
  }
  if (agent.name === "Portfolio") return readPortfolio(chain, input || sender);
  return {
    title: agent.name,
    summary: "This agent has no reader yet",
    claims: [{ label: "DATA", claim: "This registered agent has no executor in this process.", evidence: "" }],
    unavailable: [],
  };
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
        mode: market ? "chain" : "memory",
        live: Boolean(market),
        network: market ? "testnet" : (process.env.SUPRA_NETWORK || "mainnet"),
        chainId: market ? 6 : chainIdFor(process.env.SUPRA_NETWORK || "mainnet"),
        rpc: market ? deskChain.rpc : reportChain.rpc,
        reports: market ? deskChain.rpc : reportChain.rpc,
        market,
        explorer: market ? `https://testnet.suprascan.io/address/${market}` : "",
        note: market
          ? "Supra testnet. A hire is a StarKey payment. This desk does not mark a job paid until that transaction succeeds."
          : "CLERK_LEDGER=memory. Escrow is local and is not Supra.",
        faucet: Boolean(market),
      });
    }
    if (req.method === "GET" && url.pathname === "/api/status") {
      const chain = market ? deskChain : reportChain;
      let rest = { name: "Supra REST", status: "DEGRADED", detail: "The node did not answer." };
      try {
        const block = await chain.block();
        const height = block?.header?.height;
        rest = height ? { name: "Supra REST", status: "LIVE", detail: `Block ${height}` } : rest;
      } catch { /* status stays degraded */ }
      let automation = { name: "Automation", status: "NOT VERIFIED", detail: "No execution has been observed." };
      try {
        const count = await chain.view("0x1::automation_registry::get_task_count", []);
        automation = { name: "Automation", status: "NOT VERIFIED", detail: `Registry task count ${Array.isArray(count) ? count[0] : "unavailable"}. Task 6474 is not present.` };
      } catch { /* leave unverified */ }
      return send(res, 200, {
        checks: [
          rest,
          { name: "Marketplace", status: market ? "LIVE" : "NOT CONFIGURED", detail: market || "No package configured" },
          { name: "StarKey", status: "NOT VERIFIED", detail: "The browser wallet signs. This server cannot open it." },
          automation,
          { name: "Price API", status: process.env.SUPRA_PRICE_API_KEY ? "NOT VERIFIED" : "NOT CONFIGURED", detail: "SUPRA_PRICE_API_KEY is not set. Prices stay unavailable." },
          { name: "LLM", status: process.env.LLM_API_KEY ? "NOT VERIFIED" : "NOT CONFIGURED", detail: "LLM_API_KEY is not set. Writing uses the facts only." },
          { name: "Trading", status: "BLOCKED", detail: "Dexlyn swap exists. Reserves are in a table. Atmos is not on testnet. WARs has no package." },
          { name: "Wallet Cleaner", status: "LIVE", detail: "It lists assets. It does not offer a burn." },
        ],
      });
    }
    if (req.method === "POST" && url.pathname === "/api/tx") {
      if (!market) return send(res, 400, { error: "Chain mode is off." });
      const body = await jsonBody(req);
      const prepared = await prepareCall({
        kind: body.kind,
        sender: body.sender,
        agentId: body.agentId,
        input: body.input,
      });
      return send(res, 200, prepared);
    }
    if (req.method === "POST" && url.pathname === "/api/tx/status") {
      const body = await jsonBody(req);
      const tx = await deskChain.transaction(String(body.hash || ""));
      if (!tx) return send(res, 200, { status: "pending" });
      return send(res, 200, { status: tx.status === "Success" ? "success" : "failed" });
    }
    if (req.method === "POST" && url.pathname === "/api/supra-faucet") {
      const body = await jsonBody(req);
      const user = normalizeAddress(body.user);
      const response = await fetch(`https://rpc-testnet.supra.com/rpc/v1/wallet/faucet/${user}`, { headers: { "user-agent": "clerk/1.0" } });
      const text = await response.text();
      if (!response.ok) return send(res, 400, { error: "The Supra faucet did not send SUPRA. Try again in a little while." });
      return send(res, 200, { ok: true, detail: text.slice(0, 180) });
    }
    if (req.method === "POST" && url.pathname === "/api/agents/run") {
      const body = await jsonBody(req);
      const name = String(body.agent || "");
      const desk = market ? await readDesk(deskChain, market) : { agents: ledger.agents() };
      const agent = desk.agents.find((item) => item.name === name || String(item.id) === name);
      if (!agent) return send(res, 404, { error: "That agent is not registered." });
      const report = await runAgent(agent, body.input || "", body.sender || "");
      return send(res, 200, { agent: agent.name, paid: false, report });
    }
    if (req.method === "GET" && url.pathname === "/api/agents") {
      if (market) return send(res, 200, (await readDesk(deskChain, market)).agents.map(publicAgent));
      return send(res, 200, ledger.agents().map(publicAgent));
    }
    if (req.method === "POST" && url.pathname === "/api/agents") {
      if (market) return send(res, 400, { error: "Register an agent with clerk::market::register_agent in StarKey." });
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
      if (market) {
        const user = url.searchParams.get("user");
        const rows = (await readDesk(deskChain, market)).jobs.filter((item) => !user || item.user === normalizeAddress(user));
        return send(res, 200, rows.map(publicJob));
      }
      const user = url.searchParams.get("user");
      const rows = ledger.jobs().filter((item) => !user || item.user === user.toLowerCase());
      return send(res, 200, rows.map(publicJob));
    }
    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const body = await jsonBody(req);
      const input = String(body.input ?? "");
      if (market) {
        return send(res, 200, {
          mode: "chain",
          function: `${market}::market::hire`,
          args: [`u64:${body.agentId}`, `hex:${hashText(input)}`],
          note: "Sign this in StarKey. Then submit the transaction hash to /api/jobs/verify. The desk will not pretend it was paid.",
        });
      }
      const user = normalizeAddress(body.user);
      const created = ledger.hire(user, Number(body.agentId), hashText(input));
      const secret = randomBytes(16).toString("hex");
      results.set(created.id, { secret, input, report: null });
      remember(created.id, { secret, input, report: null });
      return send(res, 201, { ...publicJob(created), secret, mode: "memory" });
    }
    if (req.method === "POST" && url.pathname === "/api/jobs/verify") {
      if (!market) return send(res, 400, { error: "chain mode is off" });
      const body = await jsonBody(req);
      const checked = await verifyHire(deskChain, market, body.hash, body.input);
      if (!checked.agent) return send(res, 404, { error: "That agent is not on the desk." });
      if (checked.job.status !== "FUNDED" && checked.job.status !== "COMPLETED") {
        return send(res, 409, { error: "This payment is not open." });
      }
      let report;
      try {
        report = await runAgent(checked.agent, body.input, checked.sender);
      } catch {
        report = {
          title: checked.agent.name,
          summary: "The network did not return this",
          claims: [{ label: "DATA", claim: "Nothing was invented. Try opening the result again from Jobs.", evidence: "" }],
        };
      }
      remember(checked.job.id, { report, input: body.input });
      return send(res, 200, { job: publicJob(checked.job), report });
    }
    if (req.method === "POST" && url.pathname === "/api/jobs/open") {
      if (!market) return send(res, 400, { error: "Chain mode is off." });
      const body = await jsonBody(req);
      const id = Number(body.id);
      const input = String(body.input ?? "");
      const row = (await readDesk(deskChain, market)).jobs.find((item) => item.id === id);
      if (!row) return send(res, 404, { error: "That job was not found." });
      if (row.inputHash !== hashText(input)) return send(res, 400, { error: "That is not the request that was paid for." });
      const agent = (await readDesk(deskChain, market)).agents.find((item) => item.id === row.agentId);
      if (!agent) return send(res, 404, { error: "That agent is not on the desk." });
      const report = await runAgent(agent, input, row.user);
      remember(id, { report, input });
      return send(res, 200, { job: publicJob(row), report });
    }
    const jobRun = url.pathname.match(/^\/api\/jobs\/(\d+)\/run$/);
    if (req.method === "POST" && jobRun) {
      if (market) return send(res, 400, { error: "Completion is clerk::market::complete, signed by the agent creator." });
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
      if (market) {
        const row = (await readDesk(deskChain, market)).jobs.find((item) => item.id === id);
        if (!row) return send(res, 404, { error: "invalid job" });
        return send(res, 200, { job: publicJob(row), report: results.get(id)?.report ?? null });
      }
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
      if (market) return send(res, 400, { error: "CLERK is minted by the market admin. The testnet faucet only sends SUPRA." });
      const body = await jsonBody(req);
      const user = normalizeAddress(body.user);
      ledger.credit(user, 1000n * 100_000_000n);
      return send(res, 200, { balance: ledger.balance(user).toString() });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/balance/")) {
      const user = normalizeAddress(decodeURIComponent(url.pathname.split("/").pop()));
      const supra = market
        ? await deskChain.supraBalance(user).catch(() => null)
        : await reportChain.supraBalance(user).catch(() => null);
      const clerk = market ? (await clerkBalance(deskChain, market, user)).toString() : ledger.balance(user).toString();
      return send(res, 200, { balance: clerk, supra: supra?.toString() ?? null, mode: market ? "chain" : "memory" });
    }
    if (req.method === "POST" && url.pathname === "/api/trade/preview") {
      const body = await jsonBody(req);
      return send(res, 200, tradePreview({ pay: body.pay, receive: body.receive, slippageBps: Number(body.slippageBps || 100), quotes: discoveredVenues() }));
    }
    if (req.method === "POST" && url.pathname === "/api/cleaner/scan") {
      const body = await jsonBody(req);
      return send(res, 200, await scanWallet(reportChain, body.address, []));
    }
    if (serveWeb(req, res, url.pathname)) return;
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
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const FILE_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function serveWeb(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (pathname.startsWith("/api/")) return false;
  if (!existsSync(join(webRoot, "index.html"))) return false;
  let requested = pathname;
  try { requested = decodeURIComponent(pathname); }
  catch { return false; }
  const candidate = resolve(webRoot, `.${requested}`);
  const inside = candidate === webRoot || candidate.startsWith(webRoot + sep);
  const file = inside && existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : join(webRoot, "index.html");
  const type = FILE_TYPES[extname(file)] || "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    "cache-control": extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(file).pipe(res);
  return true;
}

export function start(port = Number(process.env.PORT || 8787)) {
  const server = createServer((req, res) => { void handle(req, res); });
  server.listen(port);
  return server;
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) start();
