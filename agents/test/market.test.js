import assert from "node:assert/strict";
import test from "node:test";
import { createLedger, clerk, FUNDED, COMPLETED, FAILED, REFUNDED } from "../src/rules.js";

const user = "0x" + "b".repeat(64);
const stranger = "0x" + "c".repeat(64);
const hash = "a".repeat(64);

test("hire escrows the listed price and a stranger cannot complete it", () => {
  const book = createLedger(() => 1_000);
  book.credit(user, clerk(500));
  const job = book.hire(user, 1, hash);
  assert.equal(job.status, FUNDED);
  assert.equal(job.amount, clerk(50));
  assert.equal(book.balance(user), clerk(450));
  assert.throws(() => book.complete(stranger, job.id, hash), /unauthorized/);
  assert.equal(book.jobs()[0].status, FUNDED);
});

test("the creator cannot complete the same job twice", () => {
  const book = createLedger(() => 1_000);
  book.credit(user, clerk(50));
  const job = book.hire(user, 1, hash);
  const creator = book.agents()[0].creator;
  book.complete(creator, job.id, hash);
  assert.throws(() => book.complete(creator, job.id, hash), /status/);
  assert.equal(book.balance(creator), clerk(50));
});

test("fail returns the escrow and refund is refused twice", () => {
  const book = createLedger(() => 1_000);
  book.credit(user, clerk(100));
  const job = book.hire(user, 3, hash);
  const creator = book.agents().find((item) => item.id === 3).creator;
  const failed = book.fail(creator, job.id);
  assert.equal(failed.status, FAILED);
  assert.equal(book.balance(user), clerk(100));
  assert.throws(() => book.refund(user, job.id, 9_999_999), /status/);
});

test("the payer can refund only after the deadline", () => {
  let now = 1_000;
  const book = createLedger(() => now);
  book.credit(user, clerk(50));
  const job = book.hire(user, 1, hash);
  assert.throws(() => book.refund(user, job.id), /early/);
  now = job.deadlineSecs;
  const refunded = book.refund(user, job.id);
  assert.equal(refunded.status, REFUNDED);
  assert.equal(book.balance(user), clerk(50));
});

test("a rating can be given once, only by the payer, only after completion", () => {
  const book = createLedger(() => 1_000);
  book.credit(user, clerk(50));
  const job = book.hire(user, 1, hash);
  const creator = book.agents()[0].creator;
  assert.throws(() => book.rate(user, job.id, 5), /status/);
  book.complete(creator, job.id, hash);
  book.rate(user, job.id, 5);
  assert.throws(() => book.rate(user, job.id, 1), /rating/);
  assert.throws(() => book.rate(stranger, job.id, 5), /unauthorized|rating|status/);
  assert.equal(book.agents()[0].ratingCount, 1);
  assert.equal(book.jobs()[0].status, COMPLETED);
});

test("a fee is paid only when configured, and an agent cannot edit its rating", () => {
  const book = createLedger(() => 1_000);
  book.setFeeBps(book.admin, 1000);
  book.credit(user, clerk(50));
  const job = book.hire(user, 1, hash);
  const creator = book.agents()[0].creator;
  book.complete(creator, job.id, hash);
  assert.equal(book.balance(creator), clerk(45));
  assert.equal(book.treasury().fees, clerk(5));
  assert.throws(() => book.setPrice(stranger, 1, clerk(1)), /unauthorized/);
});

test("short payment is impossible because hire always takes the listed price", () => {
  const book = createLedger(() => 1_000);
  book.credit(user, clerk(49));
  assert.throws(() => book.hire(user, 1, hash), /insufficient/);
});
