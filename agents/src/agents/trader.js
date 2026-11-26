export const VENUES = ["atmos", "dexlyn", "wars"];

export function parseIntent(input) {
  const text = String(input || "").trim();
  const pair = text.match(/([0-9][0-9.,]*)\s*([A-Za-z][A-Za-z0-9]*)\s+(?:for|to|into)\s+([A-Za-z][A-Za-z0-9]*)/i);
  if (pair) return { pay: `${pair[1]} ${pair[2].toUpperCase()}`, receive: pair[3].toUpperCase() };
  if (text) return { pay: text, receive: "another token" };
  return { pay: "SUPRA", receive: "another token" };
}

function venueLine(item) {
  if (item.venue === "atmos") return { title: "Atmos", detail: "Not on this testnet. Nothing was swapped." };
  if (item.venue === "dexlyn") return { title: "Dexlyn", detail: "The swap entry exists. No pool price came back, so nothing was traded." };
  if (item.venue === "wars") return { title: "WARs", detail: "No published contract, so it was not quoted." };
  return { title: item.venue || "Venue", detail: "No price came back." };
}

export function discoveredVenues() {
  return [
    {
      venue: "atmos",
      status: "discovered_not_executed",
      reason: "Mainnet package exists. It is not deployed on testnet. No swap was sent.",
    },
    {
      venue: "dexlyn",
      status: "discovered_not_executed",
      reason: "Testnet scripts::swap was read. A pool price was not returned. No swap was sent.",
    },
    {
      venue: "wars",
      status: "not_verified",
      reason: "No published package address. No swap was sent.",
    },
  ];
}

export function compareQuotes(quotes) {
  const quoted = (quotes || []).filter((item) => item.status === "quoted" && typeof item.output === "bigint");
  if (!quoted.length) {
    return {
      best: null,
      claim: "No price came back, so this will not pick a venue.",
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
  const lines = (quotes || []).map(venueLine);
  return {
    title: "Price check",
    summary: comparison.best ? comparison.claim : `No price for ${pay} to ${receive}`,
    pay,
    receive,
    slippageBps,
    executes: false,
    comparison,
    lines,
    claims: [
      {
        label: "DATA",
        claim: comparison.best ? comparison.claim : "No price came back, so nothing will be swapped.",
        evidence: "",
      },
    ],
    unavailable: [],
    source: "Atmos is not deployed on this testnet. Dexlyn's swap entry was read and did not return a pool price. WARs has no published package. Nothing was swapped.",
  };
}
