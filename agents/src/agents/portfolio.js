import { normalizeAddress } from "../address.js";
import { eventsOf, formatSupra } from "../chain.js";

const UNIT = 100_000_000n;

function coinName(type = "") {
  const name = String(type).split("::").pop()?.replace(/>$/, "") || "";
  if (name === "SupraCoin") return "SUPRA";
  if (!name || name.length > 16) return "Coin";
  return name;
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

export async function readPortfolio(chain, input) {
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const supra = await chain.supraBalance(address);
  const resources = await chain.resources(address);
  const coins = resources.filter((item) => String(item.type).includes("::coin::CoinStore<"));
  const holdings = [];
  if (supra !== null) holdings.push({ name: "SUPRA", amount: formatSupra(supra).replace(" SUPRA", "") });
  for (const coin of coins) {
    if (String(coin.type).includes("supra_coin::SupraCoin")) continue;
    const value = coin.data?.coin?.value;
    if (value === undefined || value === null) continue;
    holdings.push({ name: coinName(coin.type), amount: amount(value) || "0" });
  }
  const feed = chain.coinTransactions ? await chain.coinTransactions(address, { maxPages: 4 }) : null;
  const moved = {};
  for (const tx of feed?.transactions || []) {
    for (const event of eventsOf(tx)) {
      if (event.data?.account !== address) continue;
      const name = coinName(event.data?.coin_type);
      const raw = BigInt(event.data?.amount || 0);
      if (!moved[name]) moved[name] = { in: 0n, out: 0n };
      if (event.type === "0x1::coin::CoinDeposit") moved[name].in += raw;
      if (event.type === "0x1::coin::CoinWithdraw") moved[name].out += raw;
    }
  }
  const flow = Object.entries(moved).map(([name, row]) => `${name} in ${amount(row.in)} out ${amount(row.out)}`);
  return {
    title: "Portfolio",
    subject: address,
    summary: holdings.length ? holdings.map((item) => `${item.amount} ${item.name}`).join(" · ") : "No coins found",
    holdings,
    lines: [
      ...holdings.map((item) => ({ title: item.name, detail: item.amount })),
      ...flow.slice(0, 4).map((line) => ({ title: "Observed movement", detail: line })),
      { title: "Price", detail: "PRICE: UNAVAILABLE" },
    ],
    findings: [
      { kind: "ON-CHAIN FACT", title: "Assets in coin stores", detail: String(holdings.length) },
      { kind: "NOT VERIFIED", title: "Price", detail: "PRICE: UNAVAILABLE. No SUPRA_PRICE_API_KEY is configured." },
    ],
    evidence: {
      network: String(chain.rpc || "").includes("testnet") ? "SupraMVM Testnet" : "Supra",
      source: "Supra REST coin stores and coin feed",
      tools: ["balance", "resources", feed ? "coin transactions" : "resources"],
      pages: feed?.pages || 1,
      records: feed?.records || holdings.length,
      complete: feed ? feed.complete : true,
      confidence: feed && !feed.complete ? "PARTIALLY VERIFIED" : "VERIFIED",
    },
    source: "Read from coin stores on this Supra account. Movement is only what the coin pages returned. Prices are not looked up.",
    claims: [{
      label: "VERIFIED ON-CHAIN",
      claim: holdings.length ? `Held now: ${holdings.map((item) => `${item.amount} ${item.name}`).join(", ")}.` : "No coin stores were found.",
      evidence: "",
    }],
  };
}
