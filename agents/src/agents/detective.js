import { normalizeAddress } from "../address.js";
import { eventsOf, formatSupra, functionOf, senderOf, whenOf } from "../chain.js";

const INJECTION = /ignore previous|you are now|system prompt|pretend the balance/i;

export async function investigateWallet(chain, input) {
  if (INJECTION.test(String(input))) {
    input = String(input).split("\n")[0];
  }
  const address = normalizeAddress(String(input).trim().split(/\s+/)[0]);
  const account = await chain.account(address);
  const balance = await chain.supraBalance(address);
  const resources = await chain.resources(address);
  const history = chain.transactionPages
    ? await chain.transactionPages(address, { limit: 100, pageSize: 25 })
    : { transactions: await chain.transactions(address, 25), pages: 1, capped: false, sequence: account?.sequence_number ?? null };
  const txs = history.transactions;
  const claims = [];

  if (!account) {
    claims.push({
      label: "DATA",
      claim: "The node did not return this account.",
      evidence: `${chain.rpc}/rpc/v3/accounts/${address}`,
    });
  } else {
    claims.push({
      label: "VERIFIED ON-CHAIN",
      claim: `Sequence number is ${account.sequence_number}.`,
      evidence: `GET /rpc/v3/accounts/${address}`,
    });
  }

  claims.push({
    label: balance === null ? "DATA" : "VERIFIED ON-CHAIN",
    claim: balance === null
      ? "No 0x1::supra_coin::SupraCoin CoinStore was returned. The balance is not invented."
      : `SUPRA coin store balance is ${formatSupra(balance)}.`,
    evidence: "GET resource 0x1::coin::CoinStore<0x1::supra_coin::SupraCoin>",
  });

  const types = resources.map((item) => item.type).filter(Boolean);
  claims.push({
    label: "VERIFIED ON-CHAIN",
    claim: `${types.length} resources returned. The node sends the resource list in one response and rejected a second-page cursor, so this is the full list it gave, not a guessed total.`,
    evidence: types.slice(0, 12).join("\n") || "none",
  });

  const calls = [];
  const counterparties = new Set();
  for (const tx of txs) {
    if (tx.txn_type && tx.txn_type !== "user") continue;
    const fn = functionOf(tx);
    if (fn) calls.push({ hash: tx.hash, fn, when: whenOf(tx), sender: senderOf(tx) });
    for (const event of eventsOf(tx)) {
      const data = event.data || {};
      for (const key of ["account", "sender", "recipient", "store_owner"]) {
        if (typeof data[key] === "string" && data[key].startsWith("0x") && data[key] !== address) {
          counterparties.add(data[key]);
        }
      }
    }
  }

  if (!txs.length) {
    claims.push({
      label: "DATA",
      claim: "The account transaction feed returned no user transactions for this page.",
      evidence: "GET /rpc/v3/accounts/{address}/transactions?count=25",
    });
  } else {
    const first = txs[txs.length - 1];
    const last = txs[0];
    const shown = txs.length;
    const seq = history.sequence;
    const reach = history.capped
      ? `Showing ${shown}. Stopped at the safety limit. Account sequence is ${seq ?? "unavailable"}, so older transactions may exist.`
      : `Showing ${shown} transactions across ${history.pages} page${history.pages === 1 ? "" : "s"}.${seq !== null ? ` Account sequence is ${seq}.` : ""}`;
    claims.push({
      label: "VERIFIED ON-CHAIN",
      claim: `${reach} Newest ${whenOf(last) || "time unavailable"}. Oldest fetched ${whenOf(first) || "time unavailable"}.`,
      evidence: txs.slice(0, 8).map((tx) => `${tx.hash} ${functionOf(tx) || tx.txn_type}`).join("\n"),
    });
  }

  const suspicious = calls.filter((row) => /mint|withdraw_all|pause|upgrade|admin/i.test(row.fn));
  if (suspicious.length) {
    claims.push({
      label: "RISK SIGNAL",
      claim: "Some calls on this page use names often associated with admin control. That is a name match, not proof of privilege.",
      evidence: suspicious.map((row) => `${row.hash} ${row.fn}`).join("\n"),
    });
  }

  claims.push({
    label: "AI ANALYSIS",
    claim: "No language model rewrote this report. The lines above are the node responses. A prompt in the input cannot change a balance.",
    evidence: `Input was treated as an address only. Counterparties named in events: ${[...counterparties].slice(0, 6).join(", ") || "none on this page"}.`,
  });

  return {
    title: "Wallet Detective",
    subject: address,
    claims,
    unavailable: [
      "This page is not a full history. The node returns a limited count.",
      "Failed transactions may be absent from the account feed.",
      "A resource the node did not return is not described.",
    ],
  };
}
