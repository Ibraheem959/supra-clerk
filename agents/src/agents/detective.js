import { normalizeAddress } from "../address.js";
import { eventsOf, formatSupra, functionOf, whenOf } from "../chain.js";

const INJECTION = /ignore previous|you are now|system prompt|pretend the balance/i;
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

function coinLabel(type = "") {
  const name = String(type).split("::").pop()?.replace(/>$/, "") || "";
  if (name === "SupraCoin") return "SUPRA";
  if (name === "CLERK") return "CLERK";
  if (!name || name.length > 16) return "coins";
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
  return { title: "Account activity", detail: "" };
}

function holdingsFrom(resources, balance) {
  const rows = [];
  if (balance !== null) rows.push({ name: "SUPRA", amount: formatSupra(balance).replace(" SUPRA", "") });
  for (const item of resources) {
    const type = String(item.type || "");
    if (!type.includes("::coin::CoinStore<") || type.includes("supra_coin::SupraCoin")) continue;
    const raw = item.data?.coin?.value;
    if (raw === undefined || raw === null) continue;
    rows.push({ name: coinLabel(type), amount: amount(raw) || "0" });
  }
  return rows.slice(0, 4);
}

export async function investigateWallet(chain, input) {
  if (INJECTION.test(String(input))) input = String(input).split("\n")[0];
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const account = await chain.account(address);
  const balance = await chain.supraBalance(address);
  const resources = await chain.resources(address);
  const historyPage = chain.transactionPages
    ? await chain.transactionPages(address, { limit: 20, pageSize: 20 })
    : { transactions: await chain.transactions(address, 12), capped: false };
  const txs = (historyPage.transactions || []).filter((tx) => !tx.txn_type || tx.txn_type === "user");
  const history = txs.slice(0, 8).map((tx) => {
    const row = story(tx, address);
    return { when: clock(whenOf(tx)), title: row.title, detail: row.detail };
  });
  const watch = txs.some((tx) => /mint|withdraw_all|pause|upgrade|set_admin/i.test(functionOf(tx) || ""));
  const claims = [];
  if (!account) {
    claims.push({ label: "DATA", claim: "This account was not found.", evidence: "" });
  }
  claims.push({
    label: balance === null ? "DATA" : "VERIFIED ON-CHAIN",
    claim: balance === null
      ? "No SUPRA balance was found. None was invented."
      : `SUPRA balance is ${formatSupra(balance)}.`,
    evidence: "",
  });
  return {
    title: "Wallet report",
    subject: address,
    summary: balance === null ? "No SUPRA yet" : formatSupra(balance),
    holdings: holdingsFrom(resources, balance),
    history,
    watch: watch ? "One recent action can create coins or change a contract. The name alone does not prove control." : "",
    claims,
    unavailable: historyPage.capped ? ["Older activity is not shown."] : [],
  };
}
