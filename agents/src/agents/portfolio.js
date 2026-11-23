import { normalizeAddress } from "../address.js";
import { formatSupra } from "../chain.js";

export async function readPortfolio(chain, input) {
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const supra = await chain.supraBalance(address);
  const resources = await chain.resources(address);
  const coins = resources.filter((item) => String(item.type).includes("::coin::CoinStore<"));
  const claims = [{
    label: supra === null ? "DATA" : "VERIFIED ON-CHAIN",
    claim: supra === null ? "SUPRA coin store was not returned." : `SUPRA balance ${formatSupra(supra)}.`,
    evidence: "CoinStore<0x1::supra_coin::SupraCoin>",
  }];
  if (!coins.length) {
    claims.push({ label: "DATA", claim: "No other CoinStore resources were on the first page.", evidence: "resources page" });
  }
  for (const coin of coins.slice(0, 8)) {
    claims.push({
      label: "VERIFIED ON-CHAIN",
      claim: `${coin.type} value ${coin.data?.coin?.value ?? "missing"}.`,
      evidence: coin.type,
    });
  }
  claims.push({
    label: "AI ANALYSIS",
    claim: "No profit or loss is shown. A price was not taken from an oracle for these coins. This is not a trade.",
    evidence: "Suggestions and execution stay separate.",
  });
  return { title: "Portfolio", subject: address, claims, unavailable: ["Coins on a later resource page are omitted."] };
}
