import assert from "node:assert/strict";
import test from "node:test";
import { readFeed } from "../src/supra/feed.js";
import { planTools } from "../src/supra/investigate.js";
import { writeAbout } from "../src/agents/content.js";

test("an empty page with a cursor is not the end of the feed", async () => {
  const seen = [];
  const feed = await readFeed(async (start) => {
    seen.push(start);
    if (!start) return { body: [], cursor: "20" };
    if (start === "20") return { body: [{ hash: "0xabc" }, { hash: "0xabc" }], cursor: "" };
    throw new Error("continued past the end");
  });
  assert.deepEqual(seen, ["", "20"]);
  assert.equal(feed.records, 1);
  assert.equal(feed.pages, 2);
  assert.equal(feed.complete, true);
});

test("a feed that still has a cursor is not called complete", async () => {
  const feed = await readFeed(async (start) => ({ body: [{ hash: start || "0x1" }], cursor: "more" }), { maxPages: 2 });
  assert.equal(feed.complete, false);
  assert.equal(feed.pages, 2);
});

test("a flow question selects the coin feed and does not invent a price tool", () => {
  const tools = planTools("How much SUPRA has entered this wallet?");
  assert.ok(tools.includes("coin transactions"));
  assert.equal(tools.includes("price"), false);
});

test("a project question makes content read the published modules", async () => {
  const chain = {
    rpc: "https://rpc-testnet.supra.com",
    account: async () => ({ sequence_number: "1" }),
    supraBalance: async () => 100n,
    resources: async () => [],
    transactions: async () => [],
    modules: async () => [{ abi: { name: "market", exposed_functions: [{ name: "hire", is_entry: true }], structs: [] } }],
  };
  const written = await writeAbout(chain, "0x1 what does this package do");
  assert.match(written.post, /1 modules, 1 entry functions/);
  assert.equal(written.post.includes("1000000"), false);
});
