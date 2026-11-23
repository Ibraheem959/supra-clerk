import { normalizeAddress } from "../address.js";

export function redemptionOffers(resources, registry = []) {
  const offers = [];
  const skipped = [];
  for (const resource of resources) {
    const type = resource.type || "";
    const known = registry.find((item) => type.startsWith(item.typePrefix));
    if (!known) {
      skipped.push({
        type,
        action: "not touched",
        reason: "No verified redemption mechanism is on the list for this type.",
      });
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
  const claims = [];
  if (!result.offers.length) {
    claims.push({
      label: "DATA",
      claim: "No asset on the first resource page has a verified burn-for-SUPRA function. Nothing will be burned.",
      evidence: result.skipped.slice(0, 6).map((item) => item.type).join("\n") || "no resources",
    });
  }
  for (const offer of result.offers) {
    claims.push({
      label: "VERIFIED ON-CHAIN",
      claim: `${offer.type} matches a listed function ${offer.action}. Expected: ${offer.expected}.`,
      evidence: offer.deterministic ? "Listed as deterministic." : "Listed as not deterministic.",
    });
  }
  claims.push({
    label: "AI ANALYSIS",
    claim: "Unwanted is not decided here. A burn is offered only from the verified list, and only after you approve that exact type.",
    evidence: `Registry entries: ${registry.length}.`,
  });
  return { title: "Wallet Cleaner", subject: address, claims, actions: result.offers, unavailable: ["Objects beyond the first resource page were not scanned."] };
}
