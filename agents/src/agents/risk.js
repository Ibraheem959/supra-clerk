import { normalizeAddress } from "../address.js";

const FLAGS = [
  { name: "mint", pattern: /^mint|mint_to|mint_coin/i },
  { name: "burn", pattern: /burn/i },
  { name: "pause", pattern: /pause|freeze|unpause/i },
  { name: "upgrade", pattern: /upgrade|migrate/i },
  { name: "withdraw", pattern: /withdraw|sweep|rescue/i },
  { name: "admin", pattern: /^set_admin|transfer_ownership|accept_admin/i },
];

export function reviewAbi(moduleName, abi) {
  const functions = abi?.exposed_functions || [];
  const hits = [];
  for (const fn of functions) {
    if (!fn.is_entry || fn.visibility === "private") continue;
    const flag = FLAGS.find((item) => item.pattern.test(fn.name));
    if (!flag) continue;
    hits.push({
      label: "RISK SIGNAL",
      claim: `${moduleName} can ${flag.name} (${fn.name}).`,
      evidence: "",
    });
  }
  return hits;
}

export async function reviewContract(chain, input) {
  const text = String(input).trim();
  const [rawAddress, moduleName] = text.includes("::") ? text.split("::") : [text, ""];
  const address = normalizeAddress(rawAddress);
  const named = moduleName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(moduleName);
  const targets = [];
  if (named) targets.push(moduleName);
  else if (chain.modules) {
    const published = await chain.modules(address);
    for (const item of published) {
      const name = typeof item === "string" ? item : item.abi?.name || item.name;
      if (name) targets.push(name);
    }
  }
  if (!targets.length) {
    return {
      title: "Contract check",
      subject: address,
      summary: named ? "Contract not found" : "No contracts on this account",
      claims: [{
        label: "DATA",
        claim: named
          ? "The node did not return an ABI for that module. No privileges were inferred."
          : "No contracts were found on this account.",
        evidence: "",
      }],
      unavailable: [],
    };
  }
  const claims = [];
  for (const name of targets.slice(0, 4)) {
    const published = await chain.module(address, name);
    if (!published?.abi) {
      claims.push({
        label: "DATA",
        claim: "The node did not return an ABI for that module. No privileges were inferred.",
        evidence: "",
      });
      continue;
    }
    const hits = reviewAbi(name, published.abi);
    if (hits.length) claims.push(...hits);
    else claims.push({
      label: "VERIFIED ON-CHAIN",
      claim: `${name} was read. None of the watched actions, such as mint or upgrade, are public.`,
      evidence: "",
    });
  }
  return {
    title: "Contract check",
    subject: named ? `${address}::${moduleName}` : address,
    summary: claims.some((item) => item.label === "RISK SIGNAL") ? "Something needs a look" : "Nothing unusual in the public actions",
    lines: claims.slice(0, 6).map((item) => ({ title: item.claim, detail: "" })),
    claims,
    unavailable: [],
    source: "Read from the published contract on this Supra testnet account. A matching name is a hint, not proof.",
  };
}
