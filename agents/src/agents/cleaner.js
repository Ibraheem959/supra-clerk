import { normalizeAddress } from "../address.js";

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

export function redemptionOffers(resources, registry = []) {
  const offers = [];
  const skipped = [];
  for (const resource of resources) {
    const type = resource.type || "";
    const known = registry.find((item) => type.startsWith(item.typePrefix));
    if (!known) {
      skipped.push({ type, action: "not touched", reason: "No verified redemption mechanism is on the list for this type." });
      continue;
    }
    offers.push({
      type,
      action: known.functionName,
      expected: known.expected,
      deterministic: known.deterministic === true,
      warning: known.deterministic ? "The listed function states a fixed output." : "Output is not guaranteed.",
    });
  }
  return { offers, skipped };
}

export async function scanWallet(chain, input, registry = []) {
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const resources = await chain.resources(address);
  const result = redemptionOffers(resources, registry);
  const holdings = resources
    .filter((item) => String(item.type).includes("::coin::CoinStore<") && item.data?.coin?.value !== undefined)
    .slice(0, 6)
    .map((item) => ({ name: coinName(item.type), amount: amount(item.data.coin.value) || "0" }));
  const claims = [];
  if (!result.offers.length) {
    claims.push({
      label: "DATA",
      claim: "No asset on the first resource page has a verified burn-for-SUPRA function. Nothing will be burned.",
      evidence: "",
    });
  }
  for (const offer of result.offers) {
    claims.push({
      label: "VERIFIED ON-CHAIN",
      claim: `${coinName(offer.type)} can be redeemed. Expected: ${offer.expected}.`,
      evidence: "",
    });
  }
  return {
    title: "Cleanup",
    subject: address,
    summary: result.offers.length ? "A redeemable asset was found" : "Nothing to redeem",
    holdings,
    lines: result.offers.length
      ? result.offers.map((offer) => ({ title: coinName(offer.type), detail: offer.expected || "Listed redemption" }))
      : [{ title: "No burn offered", detail: "Nothing here can be turned back into SUPRA." }],
    claims,
    actions: result.offers,
    unavailable: [],
    source: "Read from resources on this Supra testnet account. A burn is offered only when a redemption is already listed. None are listed.",
  };
}
