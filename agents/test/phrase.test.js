import assert from "node:assert/strict";
import test from "node:test";
import { phrase } from "../src/supra/phrase.js";

test("a comma in a copied figure is not treated as a new number", async () => {
  const previous = global.fetch;
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://example.test/v1";
  process.env.LLM_MODEL = "openai/gpt-4o-mini";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "Balance is 4,839.55799 SUPRA." } }] }),
  });
  try {
    const result = await phrase("SUPRA balance is 4839.55799 SUPRA.");
    assert.equal(result.writer, "model");
    assert.match(result.text, /4,839\.55799/);
  } finally {
    global.fetch = previous;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
  }
});

test("a failed model call keeps the facts and the status", async () => {
  const previous = global.fetch;
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://example.test/v1";
  global.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { message: "Invalid API key" } }),
  });
  try {
    const result = await phrase("SUPRA balance is 1 SUPRA.");
    assert.equal(result.writer, "facts");
    assert.match(result.reason, /401/);
    assert.match(result.reason, /Invalid API key/);
    assert.equal(result.text, "SUPRA balance is 1 SUPRA.");
  } finally {
    global.fetch = previous;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
  }
});
