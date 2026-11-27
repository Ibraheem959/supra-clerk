import { splitQuery } from "./dossier.js";
import { investigate } from "../supra/investigate.js";
import { phrase } from "../supra/phrase.js";
import { researchProject } from "./research.js";
import { reviewContract } from "./risk.js";

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
  const ask = String(input || "");
  const self = /\b(my wallet|this wallet|connected wallet)\b/i.test(ask);
  const { address } = splitQuery(ask, self ? sender : "");
  if (!address) {
    return {
      title: "Content",
      summary: "Name what to write about",
      layout: "post",
      post: "Paste a wallet or a package address. The connected wallet is not used unless you write my wallet.",
      history: [],
      holdings: [],
      lines: [],
      claims: [{ label: "DATA", claim: "No subject was given, so nothing was written.", evidence: "" }],
    };
  }
  const packageAsk = /project|package|module|contract|what does|function/i.test(ask);
  const riskAsk = /risk|safe|mint|upgrade|exploit/i.test(ask);
  const extra = [];
  const facts = [];
  let evidence = null;
  if (packageAsk || riskAsk) {
    if (packageAsk) {
      const project = await researchProject(chain, address);
      extra.push(`Published modules: ${project.summary}`);
      for (const line of (project.lines || []).slice(0, 6)) facts.push(`${line.title}: ${line.detail}`);
      evidence = project.evidence;
    }
    if (riskAsk) {
      const risk = await reviewContract(chain, address);
      for (const line of (risk.lines || []).slice(0, 4)) extra.push([line.title, line.detail].filter(Boolean).join(": "));
      evidence = evidence || risk.evidence || null;
    }
  } else {
    const found = await investigate(chain, ask, self ? sender : "");
    extra.push(found.post || "");
    for (const item of found.findings || []) {
      if (item.kind === "ON-CHAIN FACT") facts.push(`${item.title}: ${item.detail}`);
    }
    evidence = found.evidence || null;
  }
  const writing = [...extra, ...facts].filter(Boolean).join(" ");
  const spoken = await phrase(writing || "No on-chain facts were returned, so nothing was written.");
  const headline = spoken.text.split(/(?<=\.)\s/)[0].slice(0, 180);
  return {
    title: "Content",
    summary: headline || "Factual post",
    subject: address,
    layout: "post",
    post: spoken.text,
    lines: [...extra, ...facts].filter(Boolean).slice(0, 6).map((line) => ({ title: "Fact used", detail: line })),
    holdings: [],
    history: [],
    findings: [],
    evidence,
    source: "Written from the Supra reads listed here. The connected wallet is used only when the request says my wallet.",
    claims: [{ label: "DATA", claim: spoken.text, evidence: "Built only from those reads." }],
  };
}
