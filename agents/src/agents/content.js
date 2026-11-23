export function writeContent(report) {
  const facts = [];
  if (report?.summary) facts.push(String(report.summary));
  for (const item of report?.holdings || []) facts.push(`${item.amount} ${item.name}`);
  for (const row of report?.history || []) facts.push([row.title, row.detail].filter(Boolean).join(" "));
  for (const item of report?.claims || []) {
    if (item?.claim) facts.push(item.claim);
  }
  const unique = facts.filter((line, index) => line && facts.indexOf(line) === index).slice(0, 4);
  if (!unique.length) {
    return {
      title: "Content",
      summary: "Nothing to write",
      subject: "empty",
      claims: [{ label: "DATA", claim: "There is no report to write from.", evidence: "Content refuses to invent a project." }],
      unavailable: [],
    };
  }
  const post = unique.join(" ");
  return {
    title: "Content",
    summary: "Draft",
    subject: report.subject || "report",
    post,
    lines: unique.slice(0, 4).map((line) => ({ title: line, detail: "" })),
    claims: [
      { label: "DATA", claim: post, evidence: "Built only from the claims already labeled in the source report." },
    ],
    unavailable: [],
  };
}
