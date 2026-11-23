import { normalizeAddress } from "../address.js";
import { formatSupra } from "../chain.js";

export async function readPortfolio(chain, input) {
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const supra = await chain.supraBalance(address);
  const resources = await chain.resources(address);
  const coins = resources.filter((item) => String(item.type).includes("::coin::CoinStore<"));
  const claims = [{
    label: supra === null ? "DATA" : "VERIFIED ON-CHAIN",
    claim: supra === null ? "No SUPRA balance was found." : `SUPRA balance is ${formatSupra(supra)}.`,
    evidence: "SUPRA balance",
  }];
  if (!coins.length) {
    claims.push({ label: "DATA", claim: "No other coins were found.", evidence: "Coin balances" });
  }
  for (const coin of coins.slice(0, 8)) {
    claims.push({
      label: "VERIFIED ON-CHAIN",
      claim: `${coin.type} value ${coin.data?.coin?.value ?? "missing"}.`,
      evidence: coin.type,
    });
  }
  claims.push({
    label: "DATA",
    claim: "No profit or loss is shown. Prices were not looked up. This is not a trade.",
    evidence: "Balance only",
  });
  return { title: "Portfolio", subject: address, claims, unavailable: ["Only the coins returned for this account are shown."] };
}
