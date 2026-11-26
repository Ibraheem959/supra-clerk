import { eventsOf, formatSupra, functionOf, whenOf } from "../chain.js";
import { splitQuery } from "../agents/dossier.js";

const UNIT = 100_000_000n;

function amount(raw) {
  try {
    const value = BigInt(raw);
    const whole = value / UNIT;
    const frac = (value % UNIT).toString().padStart(8, "0").replace(/0+$/, "");
    return `${whole}${frac ? `.${frac}` : ""}`;
  } catch {
    return "";
  }
}

function coinName(type = "") {
  const name = String(type).split("::").pop()?.replace(/>$/, "") || "Coin";
  if (name === "SupraCoin") return "SUPRA";
  return name.length > 18 ? "Coin" : name;
}

function networkOf(chain) {
  const rpc = String(chain?.rpc || "");
  if (rpc.includes("testnet")) return { name: "SupraMVM Testnet", chainId: 6 };
  if (rpc.includes("devnet")) return { name: "Supra Devnet", chainId: 50 };
  return { name: "SupraMVM Mainnet", chainId: 8 };
}

export function planTools(question = "") {
  const text = question.toLowerCase();
  const tools = ["account", "balance"];
  if (/module|contract|function|package|project/.test(text)) tools.push("modules");
  if (/automat/.test(text)) tools.push("automated transactions");
  if (/enter|left|sent|received|flow|largest|counter|who|asset|7 day|week|search|interact/.test(text) || tools.length === 2) {
    tools.push("coin transactions");
  }
  return [...new Set(tools)];
}

function add(bucket, coin, raw) {
  try { bucket[coin] = (bucket[coin] || 0n) + BigInt(raw); } catch { /* skip */ }
}

function money(bucket) {
  const parts = Object.entries(bucket).filter(([, value]) => value > 0n).map(([coin, value]) => `${amount(value)} ${coin}`);
  return parts.join(", ");
}

export async function investigate(chain, input, fallback = "") {
  const { address } = splitQuery(input, fallback);
  const question = String(input || "");
  const tools = planTools(question);
  const network = networkOf(chain);
  if (!address) {
    return {
      title: "Investigation",
      summary: "Name a wallet",
      post: "Paste a Supra address, or connect the wallet to investigate.",
      findings: [],
      evidence: { ...network, tools: [], pages: 0, records: 0, complete: false, confidence: "INSUFFICIENT DATA", hashes: [] },
      claims: [{ label: "DATA", claim: "No address was given.", evidence: "" }],
    };
  }
  const account = await chain.account(address);
  const balance = await chain.supraBalance(address);
  const sequence = account?.sequence_number !== undefined ? Number(account.sequence_number) : null;
  let coin = { transactions: [], pages: 0, records: 0, complete: true };
  if (tools.includes("coin transactions") && chain.coinTransactions) {
    coin = await chain.coinTransactions(address);
  } else if (chain.transactionPages) {
    const pages = await chain.transactionPages(address, { limit: 40, pageSize: 20 });
    coin = { transactions: pages.transactions || [], pages: pages.pages || 1, records: (pages.transactions || []).length, complete: !pages.capped };
  } else if (chain.transactions) {
    const transactions = await chain.transactions(address, 20);
    coin = { transactions, pages: 1, records: transactions.length, complete: true };
  }
  const sent = {};
  const received = {};
  const functions = new Map();
  const rows = [];
  for (const tx of coin.transactions) {
    const fn = String(functionOf(tx) || "");
    if (fn) functions.set(fn, (functions.get(fn) || 0) + 1);
    const when = whenOf(tx);
    let title = fn ? fn.split("::").pop().replaceAll("_", " ") : "Activity";
    let detail = "";
    for (const event of eventsOf(tx)) {
      if (event.type === "0x1::coin::CoinWithdraw" && event.data?.account === address) {
        const coinType = coinName(event.data.coin_type);
        add(sent, coinType, event.data.amount);
        title = `Sent ${coinType}`;
        detail = `${amount(event.data.amount)} ${coinType}`;
      }
      if (event.type === "0x1::coin::CoinDeposit" && event.data?.account === address) {
        const coinType = coinName(event.data.coin_type);
        add(received, coinType, event.data.amount);
        title = `Received ${coinType}`;
        detail = `${amount(event.data.amount)} ${coinType}`;
      }
    }
    rows.push({ when: when ? new Date(when).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "", title, detail, hash: tx.hash || "" });
  }
  let automated = null;
  if (tools.includes("automated transactions") && chain.automatedTransactions) {
    automated = await chain.automatedTransactions(address);
  }
  const largest = [...rows].sort((left, right) => {
    const leftAmount = Number((left.detail.match(/[\d.]+/) || [0])[0]);
    const rightAmount = Number((right.detail.match(/[\d.]+/) || [0])[0]);
    return rightAmount - leftAmount;
  })[0];
  const topFn = [...functions.entries()].sort((a, b) => b[1] - a[1])[0];
  const holdings = [];
  if (balance !== null && balance !== undefined) holdings.push({ name: "SUPRA", amount: formatSupra(balance).replace(" SUPRA", "") });
  const resources = chain.resources ? await chain.resources(address) : [];
  for (const item of resources) {
    const type = String(item.type || "");
    if (!type.includes("::coin::CoinStore<") || type.includes("supra_coin::SupraCoin")) continue;
    if (item.data?.coin?.value === undefined) continue;
    holdings.push({ name: coinName(type), amount: amount(item.data.coin.value) || "0" });
  }
  const sends = Number.isFinite(sequence) ? String(sequence) : "unavailable";
  const flow = [
    money(received) ? `received ${money(received)}` : "",
    money(sent) ? `sent ${money(sent)}` : "",
  ].filter(Boolean).join(" and ");
  const findings = [
    { kind: "ON-CHAIN FACT", title: "Sends recorded by the node", detail: sends },
    { kind: "ON-CHAIN FACT", title: "Coin transactions analyzed", detail: `${coin.records} across ${coin.pages} page${coin.pages === 1 ? "" : "s"}${coin.complete ? "" : ", feed not finished"}` },
    { kind: balance === null || balance === undefined ? "NOT VERIFIED" : "ON-CHAIN FACT", title: "SUPRA", detail: balance === null || balance === undefined ? "No coin store was returned." : formatSupra(balance) },
    flow ? { kind: "ON-CHAIN FACT", title: "Movement in the analyzed pages", detail: flow } : null,
    topFn ? { kind: "ON-CHAIN FACT", title: "Most-used function in those pages", detail: `${topFn[0]} · ${topFn[1]}` } : null,
    automated ? { kind: "ON-CHAIN FACT", title: "Automated transactions analyzed", detail: `${automated.records}` } : null,
    { kind: "NOT VERIFIED", title: "Price", detail: "PRICE: UNAVAILABLE. Supra Price Feeds needs an approved key, and none is configured." },
  ].filter(Boolean);
  const complete = coin.complete && (balance !== null && balance !== undefined);
  const evidence = {
    network: network.name,
    chainId: network.chainId,
    source: "Supra REST",
    tools,
    pages: coin.pages + (automated?.pages || 0),
    records: coin.records + (automated?.records || 0),
    complete: coin.complete,
    confidence: !account ? "INSUFFICIENT DATA" : complete && coin.complete ? "VERIFIED" : "PARTIALLY VERIFIED",
    hashes: rows.map((row) => row.hash).filter(Boolean).slice(0, 8),
    newest: rows[0]?.when || "",
    oldest: rows[rows.length - 1]?.when || "",
  };
  const summary = balance === null || balance === undefined
    ? `${sends} sends recorded`
    : `${formatSupra(balance)} · ${sends} sends recorded`;
  const post = [
    account ? `The node records ${sends} sends for this account.` : "The node did not return this account.",
    balance === null || balance === undefined ? "No SUPRA coin store was returned." : `SUPRA balance is ${formatSupra(balance)}.`,
    `Coin feed: ${coin.records} transactions analyzed across ${coin.pages} page${coin.pages === 1 ? "" : "s"}.${coin.complete ? " The feed ended." : " The feed did not finish, so this is not the full history."}`,
    flow ? `In those pages it ${flow}.` : "Those pages showed no coin movement for this account.",
    largest?.detail ? `Largest movement in the pages: ${largest.detail}.` : "",
    automated ? `Automation feed: ${automated.records} automated transactions.` : "",
  ].filter(Boolean).join(" ");
  return {
    title: "Wallet investigation",
    subject: address,
    summary,
    post,
    holdings,
    history: rows.slice(0, 12),
    findings,
    evidence,
    source: "Read from the Supra account, its coin stores, and the coin-transaction feed. The send count is the node sequence. The analyzed count is only what the pages returned.",
    claims: [{
      label: balance === null || balance === undefined ? "DATA" : "VERIFIED ON-CHAIN",
      claim: balance === null || balance === undefined ? "No SUPRA balance was found. None was invented." : `SUPRA balance is ${formatSupra(balance)}.`,
      evidence: "",
    }],
  };
}
