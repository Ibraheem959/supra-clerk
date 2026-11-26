import { splitQuery } from "./dossier.js";
import { investigate } from "../supra/investigate.js";
import { phrase } from "../supra/phrase.js";

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
  const found = await investigate(chain, input, sender);
  const facts = (found.findings || []).filter((item) => item.kind === "ON-CHAIN FACT").map((item) => `${item.title}: ${item.detail}`);
  const writing = facts.length ? found.post : "No on-chain facts were returned, so nothing was written.";
  const spoken = await phrase(writing);
  return {
    title: "Content",
    summary: found.summary,
    subject: address,
    post: spoken.text,
    lines: [
      ...facts.slice(0, 6).map((line) => ({ title: "On-chain fact", detail: line })),
      { title: "Writing", detail: spoken.writer === "model" ? "Phrased by the configured model. Every number was checked against the facts." : "Assembled from those facts. No model was called, and no price was added." },
    ],
    holdings: found.holdings || [],
    history: found.history || [],
    findings: found.findings || [],
    evidence: found.evidence,
    source: found.source,
    claims: [{ label: "DATA", claim: spoken.text, evidence: "Built only from the account, coin stores, and the coin feed." }],
  };
}
