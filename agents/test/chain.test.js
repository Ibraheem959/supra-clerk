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
