import { createHash } from "node:crypto";
import { BCS, HexString, Network, SupraClient } from "supra-ts-sdk";
import { normalizeAddress } from "./address.js";

const MARKET = "0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b";
let client;

function sdk() {
  if (!client) client = new SupraClient({ network: Network.TESTNET });
  return client;
}

export function hireArguments(agentId, input) {
  const hash = createHash("sha256").update(String(input)).digest();
  return [BCS.bcsSerializeUint64(BigInt(agentId)), BCS.bcsSerializeBytes(hash)];
}

export async function prepareEntry({ sender, fn, args }) {
  const from = normalizeAddress(sender);
  let sequence;
  try {
    const info = await sdk().account.getAccountInfo({ accountAddress: from });
    sequence = BigInt(info.sequence_number);
  } catch {
    throw new Error("This wallet has no testnet account yet. Get test SUPRA first, then try again.");
  }
  const raw = sdk().transaction.build.rawTxnObject({
    senderAddress: from,
    senderSequenceNumber: sequence,
    function: fn,
    functionTypeArgs: [],
    functionArgs: args,
    optionalTransactionPayloadArgs: {
      maxGas: 1500n,
      gasUnitPrice: 100000n,
      txExpiryTime: BigInt(Math.floor(Date.now() / 1000) + 180),
    },
  });
  return {
    data: HexString.fromUint8Array(raw.toBytes()).noPrefix(),
    from,
    chainId: "6",
    function: fn,
  };
}

export function prepareCall({ kind, sender, agentId, input }) {
  if (kind === "faucet") {
    return prepareEntry({
      sender,
      fn: `${MARKET}::market::faucet`,
      args: [],
    });
  }
  if (kind === "hire") {
    if (!Number.isInteger(Number(agentId)) || Number(agentId) < 1) throw new Error("Pick an agent first.");
    if (!String(input || "").trim()) throw new Error("The job needs an input.");
    return prepareEntry({
      sender,
      fn: `${MARKET}::market::hire`,
      args: hireArguments(agentId, input),
    });
  }
  throw new Error("That action is not available.");
}
