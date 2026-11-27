import { normalizeAddress } from "../address.js";
import { formatSupra } from "../chain.js";

export async function researchProject(chain, input) {
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const account = await chain.account(address);
  const modules = account ? await chain.modules(address) : [];
  const balance = await chain.supraBalance(address);
  const names = [];
  let entries = 0;
  let views = 0;
  let structs = 0;
  const callable = [];
  for (const item of modules) {
    const abi = typeof item === "string" ? null : item.abi;
    const name = typeof item === "string" ? item : abi?.name || item.name;
    if (name) names.push(name);
    for (const fn of abi?.exposed_functions || []) {
      if (fn.is_entry) {
        entries += 1;
        if (callable.length < 8) callable.push(`${name}::${fn.name}`);
      }
      if (fn.is_view) views += 1;
    }
    structs += (abi?.structs || []).length;
  }
  const summary = !account ? "Account not found" : names.length ? `${names.length} modules, ${entries} entry functions` : "No contracts published";
  return {
    title: "Project",
    subject: address,
    summary,
    holdings: balance === null ? [] : [{ name: "SUPRA", amount: formatSupra(balance).replace(" SUPRA", "") }],
    lines: [
      ...names.slice(0, 6).map((name) => ({ title: name, detail: "Published module" })),
      ...callable.slice(0, 6).map((name) => ({ title: name, detail: "Public entry. A user can call it. That does not say what it pays." })),
    ],
    findings: [
      { kind: "ON-CHAIN FACT", title: "Modules", detail: String(names.length) },
      { kind: "ON-CHAIN FACT", title: "Entry functions", detail: String(entries) },
      { kind: "ON-CHAIN FACT", title: "View functions", detail: String(views) },
      { kind: "OBSERVATION", title: "Structs", detail: String(structs) },
    ],
    evidence: {
      network: String(chain.rpc || "").includes("testnet") ? "SupraMVM Testnet" : "Supra",
      source: "Supra REST modules",
      tools: ["account", "modules"],
      pages: 1,
      records: names.length,
      complete: true,
      confidence: account ? "VERIFIED" : "INSUFFICIENT DATA",
    },
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
