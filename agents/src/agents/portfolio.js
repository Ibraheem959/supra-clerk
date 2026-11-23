import { normalizeAddress } from "../address.js";
import { formatSupra } from "../chain.js";

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
  return {
    title: "Portfolio",
    subject: address,
    summary: holdings.length ? holdings.map((item) => `${item.amount} ${item.name}`).join(" · ") : "No coins found",
    holdings: holdings.slice(0, 6),
    claims: [{
      label: supra === null ? "DATA" : "VERIFIED ON-CHAIN",
      claim: supra === null ? "No SUPRA balance was found." : `SUPRA balance is ${formatSupra(supra)}.`,
      evidence: "",
    }],
    unavailable: [],
  };
}
