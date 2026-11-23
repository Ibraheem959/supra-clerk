import assert from "node:assert/strict";
import test from "node:test";
import { createChain } from "../src/chain.js";
import { readDesk, TESTNET_MARKET } from "../src/market.js";

test("the published testnet market has the seven agents and a completed job", async () => {
  const chain = createChain("https://rpc-testnet.supra.com");
  const desk = await readDesk(chain, TESTNET_MARKET);
  assert.equal(desk.agents.length, 7);
  assert.equal(desk.agents[0].name, "Wallet Detective");
  assert.equal(desk.agents[0].price, 5_000_000_000n);
  const job = desk.jobs.find((item) => item.id === 1);
  assert.equal(job.status, "COMPLETED");
  assert.equal(desk.config.fee_bps, "0");
});

test("transaction pages walk older sequence numbers without repeating a hash", async () => {
  const chain = createChain("https://rpc-testnet.supra.com");
  const history = await chain.transactionPages(TESTNET_MARKET, { limit: 8, pageSize: 2 });
  const hashes = history.transactions.map((tx) => tx.hash);
  assert.equal(new Set(hashes).size, hashes.length);
  assert.ok(hashes.length > 2);
  const sequences = history.transactions.map((tx) => Number(tx.header.sequence_number));
  for (let i = 1; i < sequences.length; i += 1) assert.ok(sequences[i] < sequences[i - 1]);
});
