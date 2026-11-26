import { normalizeAddress } from "./address.js";
import { readFeed } from "./supra/feed.js";

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
  if (response.status === 400) {
    const text = await response.text();
    if (/not found|Resource not found|Information not available/i.test(text)) return null;
    throw new Error("The network rejected that request.");
  }
  if (!response.ok) throw new Error("The network did not answer. Try again.");
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
      const pages = await this.transactionPages(address, { limit: count, pageSize: Math.min(count, 25) });
      return pages.transactions;
    },
    async transactionPages(address, { limit = 100, pageSize = 25 } = {}) {
      const account = normalizeAddress(address);
      const cap = Math.max(1, Math.min(limit, 500));
      const size = Math.max(1, Math.min(pageSize, 25));
      const transactions = [];
      let cursor = null;
      let pages = 0;
      while (transactions.length < cap) {
        const ask = Math.min(size, cap - transactions.length);
        const query = cursor === null
          ? `count=${ask}`
          : `count=${ask}&start=${cursor}`;
        const body = await readJson(`${base}/rpc/v3/accounts/${account}/transactions?${query}`);
        const page = Array.isArray(body) ? body : [];
        pages += 1;
        if (!page.length) break;
        transactions.push(...page);
        const oldest = page[page.length - 1];
        const sequence = Number(oldest?.header?.sequence_number);
        if (!Number.isFinite(sequence) || sequence <= 0) break;
        cursor = sequence - 1;
        if (page.length < ask) break;
      }
      const info = await readJson(`${base}/rpc/v3/accounts/${account}`);
      const sequence = info?.sequence_number !== undefined ? Number(info.sequence_number) : null;
      return {
        transactions,
        pages,
        capped: transactions.length >= cap,
        sequence,
      };
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
    async coinTransactions(address, options = {}) {
      const account = normalizeAddress(address);
      return readFeed(async (start) => {
        const query = start ? `count=25&start=${encodeURIComponent(start)}` : "count=25";
        const response = await fetch(`${base}/rpc/v3/accounts/${account}/coin_transactions?${query}`, {
          headers: { "user-agent": "clerk/1.0", accept: "application/json" },
        });
        if (response.status === 404) return { body: [], cursor: "" };
        if (!response.ok) throw new Error("The coin feed did not answer.");
        return { body: await response.json(), cursor: response.headers.get("x-supra-cursor") };
      }, { maxPages: options.maxPages || 8 });
    },
    async automatedTransactions(address, options = {}) {
      const account = normalizeAddress(address);
      return readFeed(async (start) => {
        const query = start ? `count=20&cursor=${encodeURIComponent(start)}` : "count=20";
        const response = await fetch(`${base}/rpc/v3/accounts/${account}/automated_transactions?${query}`, {
          headers: { "user-agent": "clerk/1.0", accept: "application/json" },
        });
        if (response.status === 404) return { body: [], cursor: "" };
        if (!response.ok) throw new Error("The automation feed did not answer.");
        return { body: await response.json(), cursor: response.headers.get("x-supra-cursor") };
      }, { maxPages: options.maxPages || 4 });
    },
    async view(functionName, args = []) {
      const response = await fetch(`${base}/rpc/v3/view`, {
        method: "POST",
        headers: { "user-agent": "clerk/1.0", "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ function: functionName, type_arguments: [], arguments: args }),
      });
      if (!response.ok) return null;
      const body = await response.json();
      return body?.result ?? null;
    },
    async block() {
      return readJson(`${base}/rpc/v3/block`);
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
