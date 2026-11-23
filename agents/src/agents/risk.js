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
      claim: `Public entry ${moduleName}::${fn.name} matches a ${flag.name} name. Parameters: ${(fn.params || []).join(", ") || "none"}.`,
      evidence: "Public function",
    });
  }
  return hits;
}

export async function reviewContract(chain, input) {
  const text = String(input).trim();
  const [rawAddress, moduleName] = text.includes("::") ? text.split("::") : [text, ""];
  const address = normalizeAddress(rawAddress);
  if (!moduleName || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(moduleName)) {
    return {
      title: "Contract Risk",
      subject: address,
      claims: [{
        label: "DATA",
        claim: "Provide an address and a module name, like 0xabc::market.",
        evidence: "No contract was read.",
      }],
      unavailable: ["The contract code was not opened line by line."],
    };
  }
  const published = await chain.module(address, moduleName);
  if (!published?.abi) {
    return {
      title: "Contract Risk",
      subject: `${address}::${moduleName}`,
      claims: [{
        label: "DATA",
        claim: "The node did not return an ABI for that module. No privileges were inferred.",
        evidence: address,
      }],
      unavailable: ["Unpublished or renamed modules cannot be reviewed from this call."],
    };
  }
  const hits = reviewAbi(moduleName, published.abi);
  const claims = hits.length ? hits : [{
    label: "VERIFIED ON-CHAIN",
    claim: `${moduleName} was read. None of the watched actions, such as mint or upgrade, are public.`,
    evidence: "Names only. This is not a safety certificate.",
  }];
  claims.push({
    label: "DATA",
    claim: "A matching name is a hint, not proof that funds can be taken.",
    evidence: "The contract was not taken apart beyond its public functions.",
  });
  return { title: "Contract Risk", subject: `${address}::${moduleName}`, claims, unavailable: ["Only the public functions were read."] };
}
