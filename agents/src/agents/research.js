import { normalizeAddress } from "../address.js";
import { formatSupra } from "../chain.js";

export async function researchProject(chain, input) {
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const account = await chain.account(address);
  const modules = await chain.modules(address);
  const balance = await chain.supraBalance(address);
  const names = modules.map((item) => (typeof item === "string" ? item : item.abi?.name || item.name)).filter(Boolean);
  const claims = [
    {
      label: account ? "VERIFIED ON-CHAIN" : "DATA",
      claim: account ? `This account has sent ${account.sequence_number} transactions.` : "This account was not found.",
      evidence: address,
    },
    {
      label: "VERIFIED ON-CHAIN",
      claim: names.length ? `Contracts published here: ${names.join(", ")}.` : "No contracts were found on this account.",
      evidence: "Published contracts",
    },
    {
      label: balance === null ? "DATA" : "VERIFIED ON-CHAIN",
      claim: balance === null ? "No SUPRA balance was found." : `SUPRA balance is ${formatSupra(balance)}.`,
      evidence: "SUPRA balance",
    },
    {
      label: "DATA",
      claim: "Prices and social links are not included. This is not a valuation.",
      evidence: "Those were not looked up.",
    },
  ];
  return {
    title: "Project Research",
    subject: address,
    claims,
    unavailable: ["How many people hold it was not counted.", "No market price was added."],
  };
}
