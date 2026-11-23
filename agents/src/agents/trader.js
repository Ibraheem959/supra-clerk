export const VENUES = ["atmos", "dexlyn", "wars"];

export function discoveredVenues() {
  return [
    {
      venue: "atmos",
      status: "discovered_not_executed",
      reason: "Mainnet package 0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234 entry atmos_entry::swap_exact_in_weighted_entry. Not deployed on testnet. No swap was sent.",
    },
    {
      venue: "dexlyn",
      status: "discovered_not_executed",
      reason: "Testnet package 0x4496a672452b0bf5eff5e1616ebfaf7695e14b02a12ed211dd4f28ac38a5d54c entry scripts::swap. The entry was read. A pool was not replayed.",
    },
    {
      venue: "wars",
      status: "not_verified",
      reason: "dex.supwars.fun/audit names wars_pool::swap_exact_in and does not publish a package address.",
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
        claim: comparison.best ? comparison.claim : "No price came back, so nothing will be swapped.",
        evidence: comparison.best ? comparison.claim : "Atmos, Dexlyn, and WARs were checked. None returned a price.",
      },
    ],
    unavailable: comparison.best ? [] : ["Nothing was traded."],
  };
}
