import { normalizeAddress } from "../address.js";
import { formatSupra } from "../chain.js";

export async function researchProject(chain, input) {
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const account = await chain.account(address);
  const modules = account ? await chain.modules(address) : [];
  const balance = await chain.supraBalance(address);
  const names = modules.map((item) => (typeof item === "string" ? item : item.abi?.name || item.name)).filter(Boolean);
  const summary = !account ? "Account not found" : names.length ? names.slice(0, 4).join(", ") : "No contracts published";
  return {
    title: "Project",
    subject: address,
    summary,
    holdings: balance === null ? [] : [{ name: "SUPRA", amount: formatSupra(balance).replace(" SUPRA", "") }],
    lines: names.slice(0, 8).map((name) => ({ title: name, detail: "Published on this account" })),
    claims: [
      {
        label: account ? "VERIFIED ON-CHAIN" : "DATA",
        claim: account ? `This account has sent ${account.sequence_number} transactions.` : "This account was not found.",
        evidence: "",
      },
      {
        label: "VERIFIED ON-CHAIN",
        claim: names.length ? `Contracts published here: ${names.join(", ")}.` : "No contracts were found on this account.",
        evidence: "",
      },
      {
        label: balance === null ? "DATA" : "VERIFIED ON-CHAIN",
        claim: balance === null ? "No SUPRA balance was found." : `SUPRA balance is ${formatSupra(balance)}.`,
        evidence: "",
      },
    ],
    unavailable: [],
    source: "Read from the Supra testnet account and the contracts published on it.",
  };
}
