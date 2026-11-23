export function writeContent(report) {
  const facts = (report?.claims || []).filter((item) => item.label === "VERIFIED ON-CHAIN" || item.label === "DATA" || item.label === "RISK SIGNAL");
  if (!facts.length) {
    return {
      title: "Content",
      subject: "empty",
      claims: [{ label: "DATA", claim: "There is no report to write from.", evidence: "Content refuses to invent a project." }],
      unavailable: [],
    };
  }
  const lines = facts.slice(0, 4).map((item) => item.claim);
  const post = lines.join(" ");
  return {
    title: "Content",
    subject: report.subject || "report",
    claims: [
      { label: "DATA", claim: post, evidence: "Built only from the claims already labeled in the source report." },
      { label: "AI ANALYSIS", claim: "This is a rearrangement of those claims. It adds no price, no holder count, and no promise.", evidence: lines.join("\n") },
    ],
    unavailable: ["No X account was posted to. Copy the text yourself."],
  };
}
