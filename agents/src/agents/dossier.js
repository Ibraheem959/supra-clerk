import { normalizeAddress } from "../address.js";
import { eventsOf, formatSupra, functionOf, whenOf } from "../chain.js";

const UNIT = 100_000_000n;
const INJECTION = /ignore previous|you are now|system prompt|pretend the balance/i;

export function splitQuery(input, fallback = "") {
  let text = String(input || "").trim();
  if (INJECTION.test(text)) text = text.split("\n")[0].replace(INJECTION, "");
  const match = text.match(/0x[0-9a-fA-F]{1,64}/);
  let address = "";
  try {
    address = normalizeAddress(match ? match[0] : fallback);
  } catch {
    address = "";
  }
  return { address, text };
}

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

function coinLabel(type = "") {
  const name = String(type).split("::").pop()?.replace(/>$/, "") || "";
  if (name === "SupraCoin") return "SUPRA";
  if (name === "CLERK") return "CLERK";
  if (!name || name.length > 16) return "Coin";
  return name;
}

function clock(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function story(tx, self) {
  const events = eventsOf(tx);
  const hired = events.find((event) => String(event.type || "").endsWith("::Hired") && event.data?.user === self);
  if (hired) {
    const paid = amount(hired.data?.amount);
    return { title: "Hired an agent", detail: paid ? `${paid} CLERK` : "Payment sent" };
  }
  const sent = events.find((event) => event.type === "0x1::coin::CoinWithdraw" && event.data?.account === self);
  if (sent) {
    const coin = coinLabel(sent.data?.coin_type);
    const paid = amount(sent.data?.amount);
    return { title: `Sent ${coin}`, detail: paid ? `${paid} ${coin}` : "" };
  }
  const got = events.find((event) => event.type === "0x1::coin::CoinDeposit" && event.data?.account === self);
  if (got) {
    const coin = coinLabel(got.data?.coin_type);
    const paid = amount(got.data?.amount);
    const fromFaucet = String(functionOf(tx)).endsWith("::faucet");
    return { title: fromFaucet ? "Claimed test coins" : `Received ${coin}`, detail: paid ? `${paid} ${coin}` : "" };
  }
  const name = String(functionOf(tx) || "").split("::").pop();
  if (name === "transfer" || name === "batch_transfer") return { title: "Sent SUPRA", detail: "" };
  if (name) return { title: name.replaceAll("_", " "), detail: "" };
  return { title: "Account activity", detail: "" };
}

function add(bucket, coin, raw) {
  try {
    bucket[coin] = (bucket[coin] || 0n) + BigInt(raw);
  } catch { /* skip a malformed amount */ }
}

function money(bucket) {
  return Object.entries(bucket)
    .filter(([, value]) => value > 0n)
    .map(([coin, value]) => `${amount(value)} ${coin}`)
    .join(", ");
}

export async function readDossier(chain, input, fallback = "") {
  const { address } = splitQuery(input, fallback);
  if (!address) {
    return { address: "", missing: true, holdings: [], rows: [], sequence: null };
  }
  const account = await chain.account(address);
  const balance = await chain.supraBalance(address);
  const resources = account ? await chain.resources(address) : [];
  const history = chain.transactionPages
    ? await chain.transactionPages(address, { limit: 40, pageSize: 20 })
    : { transactions: await chain.transactions(address, 20), capped: false, sequence: null };
  const txs = (history.transactions || []).filter((tx) => !tx.txn_type || tx.txn_type === "user");
  const sent = {};
  const received = {};
  const others = new Map();
  const rows = [];
  for (const tx of txs) {
    const line = story(tx, address);
    const when = clock(whenOf(tx));
    rows.push({
      when,
      title: line.title,
      detail: line.detail,
      search: `${when} ${line.title} ${line.detail}`.toLowerCase(),
    });
    for (const event of eventsOf(tx)) {
      if (event.type === "0x1::coin::CoinWithdraw" && event.data?.account === address) {
        add(sent, coinLabel(event.data.coin_type), event.data.amount);
      }
      if (event.type === "0x1::coin::CoinDeposit" && event.data?.account === address) {
        add(received, coinLabel(event.data.coin_type), event.data.amount);
      }
      for (const key of ["sender", "recipient", "store_owner", "user"]) {
        const other = event.data?.[key];
        if (typeof other === "string" && other.startsWith("0x")) {
          let normalized = other;
          try { normalized = normalizeAddress(other); } catch { continue; }
          if (normalized === address) continue;
          others.set(normalized, (others.get(normalized) || 0) + 1);
        }
      }
    }
  }
  const holdings = [];
  if (balance !== null) holdings.push({ name: "SUPRA", amount: formatSupra(balance).replace(" SUPRA", "") });
  for (const item of resources) {
    const type = String(item.type || "");
    if (!type.includes("::coin::CoinStore<") || type.includes("supra_coin::SupraCoin")) continue;
    if (item.data?.coin?.value === undefined) continue;
    holdings.push({ name: coinLabel(type), amount: amount(item.data.coin.value) || "0" });
  }
  const sequence = account?.sequence_number !== undefined ? Number(account.sequence_number) : history.sequence;
  const ranked = [...others.entries()].sort((left, right) => right[1] - left[1]);
  return {
    address,
    missing: !account,
    sequence: Number.isFinite(sequence) ? sequence : null,
    balance,
    balanceText: balance === null ? "" : formatSupra(balance),
    holdings: holdings.slice(0, 6),
    rows,
    fetched: txs.length,
    capped: Boolean(history.capped),
    sentText: money(sent),
    receivedText: money(received),
    top: ranked[0] ? `${ranked[0][0].slice(0, 6)}…${ranked[0][0].slice(-4)}` : "",
    topCount: ranked[0]?.[1] || 0,
    newest: rows[0]?.when || "",
    oldest: rows[rows.length - 1]?.when || "",
    source: "Read from the Supra testnet account, its coin stores, and its transactions. No price was added.",
  };
}

export function answer(dossier, ask = "") {
  const total = dossier.sequence === null ? "an unknown number of" : String(dossier.sequence);
  const holds = dossier.holdings.length
    ? dossier.holdings.map((item) => `${item.amount} ${item.name}`).join(" and ")
    : "no coins";
  const moved = [
    dossier.sentText ? `sent ${dossier.sentText}` : "",
    dossier.receivedText ? `received ${dossier.receivedText}` : "",
  ].filter(Boolean).join(" and ");
  const question = ask.toLowerCase();
  let headline = `${total} transactions sent`;
  if (/who|paid|with/.test(question) && dossier.top) headline = `Most often with ${dossier.top}`;
  else if (/hold|balance|coin|portfolio/.test(question)) headline = holds;
  else if (/sent|paid out|outflow/.test(question) && dossier.sentText) headline = `Sent ${dossier.sentText}`;
  const sentences = [
    dossier.missing ? "This account was not found on testnet." : `This account has sent ${total} transactions.`,
    `It holds ${holds}.`,
    moved ? `Across the latest ${dossier.fetched}, it ${moved}.` : "",
    dossier.top ? `The other account seen most often is ${dossier.top}, ${dossier.topCount} time${dossier.topCount === 1 ? "" : "s"}.` : "",
    dossier.newest ? `Newest activity ${dossier.newest}.${dossier.oldest && dossier.oldest !== dossier.newest ? ` Oldest fetched ${dossier.oldest}.` : ""}` : "",
    dossier.capped ? `The list is the latest ${dossier.fetched}. The total above is every send, which Supra stores as the account sequence.` : "",
  ].filter(Boolean);
  return {
    headline,
    body: sentences.join(" "),
    lines: [
      { title: "Transactions sent", detail: total },
      { title: "Holds", detail: holds },
      dossier.sentText ? { title: "Sent, latest page", detail: dossier.sentText } : null,
      dossier.receivedText ? { title: "Received, latest page", detail: dossier.receivedText } : null,
    ].filter(Boolean),
  };
}
