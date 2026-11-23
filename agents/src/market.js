import { createHash } from "node:crypto";
import { normalizeAddress } from "./address.js";
import { functionOf, senderOf } from "./chain.js";

export const TESTNET_MARKET = "0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b";

const STATUS = { 1: "FUNDED", 2: "COMPLETED", 3: "FAILED", 4: "REFUNDED" };

export function marketAddress() {
  if (process.env.CLERK_LEDGER === "memory") return "";
  return process.env.CLERK_MARKET_ADDRESS || TESTNET_MARKET;
}

export async function readDesk(chain, market) {
  const account = normalizeAddress(market);
  const registry = await chain.resource(account, `${account}::market::Registry`);
  const config = await chain.resource(account, `${account}::market::Config`);
  if (!registry?.data) throw new Error("market registry was not on chain");
  const agents = (registry.data.agents || []).map(presentAgent);
  const jobs = (registry.data.jobs || []).map(presentJob);
  return { config: config?.data || null, agents, jobs };
}

export async function clerkBalance(chain, market, user) {
  const account = normalizeAddress(market);
  const row = await chain.resource(user, `0x1::coin::CoinStore<${account}::market::CLERK>`);
  return row?.data?.coin?.value ? BigInt(row.data.coin.value) : 0n;
}

export async function verifyHire(chain, market, hash, input) {
  const tx = await chain.transaction(hash);
  if (!tx || tx.status !== "Success") throw new Error("hire transaction was not successful");
  const expected = `${normalizeAddress(market)}::market::hire`;
  if (functionOf(tx) !== expected) throw new Error("transaction is not clerk::market::hire");
  const inputHash = createHash("sha256").update(String(input)).digest("hex");
  const args = tx.payload?.Move?.arguments || [];
  const argHash = String(args[1] || "").replace(/^0x/, "");
  if (argHash !== inputHash) throw new Error("input does not match the transaction");
  const sender = normalizeAddress(senderOf(tx));
  const desk = await readDesk(chain, market);
  const job = desk.jobs.find((item) => item.inputHash === inputHash && item.user === sender);
  if (!job) throw new Error("no escrowed job matches that hire");
  return { txHash: hash, sender, job, agent: desk.agents.find((item) => item.id === job.agentId) };
}

function presentAgent(raw) {
  return {
    id: Number(raw.id),
    creator: raw.creator,
    name: raw.name,
    description: raw.description,
    category: raw.category,
    price: BigInt(raw.price),
    inputType: raw.input_type,
    permissions: raw.permissions,
    active: raw.active,
    completed: Number(raw.completed),
    failed: Number(raw.failed),
    ratingSum: Number(raw.rating_sum),
    ratingCount: Number(raw.rating_count),
    volume: BigInt(raw.volume),
  };
}

function presentJob(raw) {
  return {
    id: Number(raw.id),
    user: raw.user,
    agentId: Number(raw.agent_id),
    amount: BigInt(raw.amount),
    fee: BigInt(raw.fee),
    inputHash: String(raw.input_hash).replace(/^0x/, ""),
    resultHash: raw.result_hash ? String(raw.result_hash).replace(/^0x/, "") : "",
    status: STATUS[raw.status] || String(raw.status),
    createdSecs: Number(raw.created_secs),
    deadlineSecs: Number(raw.deadline_secs),
    rated: raw.rated,
  };
}
