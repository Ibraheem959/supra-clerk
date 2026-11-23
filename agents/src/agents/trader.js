export const VENUES = ["atmos", "dexlyn", "wars"];

export function compareQuotes(quotes) {
  const quoted = (quotes || []).filter((item) => item.status === "quoted" && typeof item.output === "bigint");
  if (!quoted.length) {
    return {
      best: null,
      claim: "No supported venue returned a verified quote. Best price is not claimed.",
    };
  }
  const best = quoted.reduce((left, right) => (right.output > left.output ? right : left));
  const queried = new Set(quoted.map((item) => item.venue));
  const missing = VENUES.filter((venue) => !queried.has(venue));
  return {
    best,
    claim: missing.length
      ? `Best among the venues that answered (${[...queried].join(", ")}). Not queried: ${missing.join(", ")}.`
      : `Best of Atmos, Dexlyn, and WARs by quoted output: ${best.venue}.`,
  };
}

export function tradePreview({ pay, receive, slippageBps = 100, quotes }) {
  const comparison = compareQuotes(quotes);
  return {
    title: "Trading",
    action: "SWAP PREVIEW",
    pay,
    receive,
    slippageBps,
    executes: false,
    comparison,
    claims: [
      {
        label: "DATA",
        claim: comparison.claim,
        evidence: (quotes || []).map((item) => `${item.venue}: ${item.status}${item.reason ? ` (${item.reason})` : ""}`).join("\n"),
      },
      {
        label: "AI ANALYSIS",
        claim: "No transaction was built. StarKey would have to show the exact entry before anything moves.",
        evidence: "executes=false",
      },
    ],
    unavailable: ["Official Atmos, Dexlyn, and WARs swap entry points are not pinned in this build, so quotes stay unverified."],
  };
}
