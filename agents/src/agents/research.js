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
      claim: account ? `Account sequence is ${account.sequence_number}.` : "The node did not return this account.",
      evidence: `GET /rpc/v3/accounts/${address}`,
    },
    {
      label: "VERIFIED ON-CHAIN",
      claim: names.length ? `Published modules on the first page: ${names.join(", ")}.` : "No modules were returned for this account.",
      evidence: `GET /rpc/v3/accounts/${address}/modules`,
    },
    {
      label: balance === null ? "DATA" : "VERIFIED ON-CHAIN",
      claim: balance === null ? "SUPRA coin balance was not on this account." : `SUPRA coin store holds ${formatSupra(balance)}.`,
      evidence: "CoinStore<0x1::supra_coin::SupraCoin>",
    },
    {
      label: "AI ANALYSIS",
      claim: "Holder counts, prices, and social links were not queried, so they are omitted. Nothing here is a valuation.",
      evidence: "Absent fields are left blank on purpose.",
    },
  ];
  return {
    title: "Project Research",
    subject: address,
    claims,
    unavailable: ["Holder distribution is not on the account resource API used here.", "No market price was attached."],
  };
}
