import { answer, readDossier, splitQuery } from "./dossier.js";

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

export async function writeAbout(chain, input, sender = "") {
  const { address } = splitQuery(input, sender);
  if (!address) {
    return {
      title: "Content",
      summary: "Name a wallet",
      post: "Content writes only from a Supra account. Paste an address, or connect the wallet you want described.",
      claims: [{ label: "DATA", claim: "There is no report to write from.", evidence: "Content refuses to invent a project." }],
    };
  }
  const dossier = await readDossier(chain, address);
  const asked = String(input || "").replace(/0x[0-9a-fA-F]{1,64}/g, " ").replace(/ignore previous|you are now|system prompt|pretend the balance/ig, "").trim();
  const written = answer(dossier, asked);
  return {
    title: "Content",
    summary: written.headline,
    subject: address,
    post: written.body,
    lines: written.lines,
    holdings: dossier.holdings.slice(0, 4),
    source: dossier.source,
    history: dossier.rows.slice(0, 6),
    claims: [{ label: "DATA", claim: written.body, evidence: "Built only from the account, coin stores, and transactions." }],
  };
}
