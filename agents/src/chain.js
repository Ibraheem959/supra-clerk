import { normalizeAddress } from "./address.js";

const QUANTS = 100_000_000n;

export function supraRpc(network = process.env.SUPRA_NETWORK || "mainnet") {
  if (network === "testnet") return "https://rpc-testnet.supra.com";
  if (network === "devnet") return "https://rpc-devnet.supra.com";
  return "https://rpc-mainnet.supra.com";
}

export function chainIdFor(network = process.env.SUPRA_NETWORK || "mainnet") {
  if (network === "testnet") return 6;
  if (network === "devnet") return 50;
  return 8;
}

async function readJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "clerk/1.0", accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Supra RPC ${response.status} for ${url}`);
  return response.json();
}

export function createChain(rpc = supraRpc()) {
  const base = rpc.replace(/\/$/, "");

  async function resource(address, type) {
    const account = normalizeAddress(address);
    const url = `${base}/rpc/v3/accounts/${account}/resources/${encodeURIComponent(type)}`;
    return readJson(url);
  }

  return {
    rpc: base,
    async account(address) {
      return readJson(`${base}/rpc/v3/accounts/${normalizeAddress(address)}`);
    },
    async resources(address) {
      const body = await readJson(`${base}/rpc/v3/accounts/${normalizeAddress(address)}/resources`);
      return Array.isArray(body) ? body : [];
    },
    resource,
    async supraBalance(address) {
      const row = await resource(address, "0x1::coin::CoinStore<0x1::supra_coin::SupraCoin>");
      if (!row?.data?.coin?.value) return null;
      return BigInt(row.data.coin.value);
    },
    async transactions(address, count = 20) {
      const body = await readJson(`${base}/rpc/v3/accounts/${normalizeAddress(address)}/transactions?count=${count}`);
      return Array.isArray(body) ? body : [];
    },
    async transaction(hash) {
      return readJson(`${base}/rpc/v3/transactions/${hash}`);
    },
    async module(address, name) {
      return readJson(`${base}/rpc/v3/accounts/${normalizeAddress(address)}/modules/${name}`);
    },
    async modules(address) {
      const body = await readJson(`${base}/rpc/v3/accounts/${normalizeAddress(address)}/modules`);
      return Array.isArray(body) ? body : [];
    },
  };
}

export function formatSupra(quants) {
  if (quants === null || quants === undefined) return "unavailable";
  const whole = quants / QUANTS;
  const frac = (quants % QUANTS).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole.toString()}${frac ? `.${frac}` : ""} SUPRA`;
}

export function senderOf(tx) {
  return tx?.header?.sender?.Move || tx?.header?.sender || "";
}

export function functionOf(tx) {
  return tx?.payload?.Move?.function || "";
}

export function eventsOf(tx) {
  return tx?.output?.Move?.events || [];
}

export function whenOf(tx) {
  return tx?.block_header?.timestamp?.utc_date_time || "";
}
