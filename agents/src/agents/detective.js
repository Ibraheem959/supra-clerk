import { formatSupra } from "../chain.js";
import { readDossier, splitQuery } from "./dossier.js";

export async function investigateWallet(chain, input) {
  const { address } = splitQuery(input);
  const dossier = await readDossier(chain, address || input);
  const ask = String(input || "").replace(/0x[0-9a-fA-F]{1,64}/g, " ");
  const wanted = /[a-z]{3,}/i.test(ask) && !/ignore previous|you are now|system prompt|pretend/i.test(ask)
    ? ask.toLowerCase().trim()
    : "";
  const rows = wanted
    ? dossier.rows.filter((row) => row.search.includes(wanted.split(/\s+/)[0]))
    : dossier.rows;
  const claims = [];
  if (dossier.missing) claims.push({ label: "DATA", claim: "This account was not found.", evidence: "" });
  claims.push({
    label: dossier.balance === null || dossier.balance === undefined ? "DATA" : "VERIFIED ON-CHAIN",
    claim: dossier.balance === null || dossier.balance === undefined
      ? "No SUPRA balance was found. None was invented."
      : `SUPRA balance is ${dossier.balanceText || formatSupra(dossier.balance)}.`,
    evidence: "",
  });
  const total = dossier.sequence === null ? "Transactions sent are unavailable" : `${dossier.sequence} transactions sent`;
  return {
    title: "Wallet report",
    subject: dossier.address,
    summary: dossier.balanceText ? `${dossier.balanceText} · ${total}` : total,
    holdings: dossier.holdings,
    history: (rows.length ? rows : dossier.rows).slice(0, 12),
    source: dossier.source,
    watch: wanted && !rows.length ? "Nothing in the latest activity matched that search. The totals above are still the full account." : "",
    claims,
    unavailable: dossier.capped ? ["The list is the latest activity. The transaction total is the account sequence."] : [],
  };
}
