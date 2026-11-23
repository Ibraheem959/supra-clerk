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
      evidence: `ABI exposed_functions.${fn.name} is_entry=${fn.is_entry}`,
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
        evidence: "No module was fetched.",
      }],
      unavailable: ["Bytecode was not decompiled."],
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
        evidence: `GET /rpc/v3/accounts/${address}/modules/${moduleName}`,
      }],
      unavailable: ["Unpublished or renamed modules cannot be reviewed from this call."],
    };
  }
  const hits = reviewAbi(moduleName, published.abi);
  const claims = hits.length ? hits : [{
    label: "VERIFIED ON-CHAIN",
    claim: `The ABI for ${moduleName} has ${(published.abi.exposed_functions || []).length} exposed functions and none of the watched names are public entries.`,
    evidence: "Name scan only. It is not a proof that the module is safe.",
  }];
  claims.push({
    label: "AI ANALYSIS",
    claim: "A matching name is a signal, not a finding that funds can be taken. Upgradeability is not proven unless an upgrade entry is in the ABI.",
    evidence: "No decompiler was run.",
  });
  return { title: "Contract Risk", subject: `${address}::${moduleName}`, claims, unavailable: ["Dependencies inside the bytecode were not walked."] };
}
