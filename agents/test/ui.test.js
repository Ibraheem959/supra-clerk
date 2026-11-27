import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("suggested questions do not insert the connected wallet", () => {
  const source = readFileSync(new URL("../../frontend/src/App.jsx", import.meta.url), "utf8");
  assert.equal(source.includes("${address} ${prompt}"), false);
  assert.match(source, /Use my wallet/);
  assert.match(source, /Write a short factual post about this package/);
});

test("the desk layout collapses to one column on a phone", () => {
  const css = readFileSync(new URL("../../frontend/src/styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.grid \{ grid-template-columns: 1fr; \}/);
});
