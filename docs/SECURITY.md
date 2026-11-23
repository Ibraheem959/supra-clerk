# Security

## Payment

The Move module on testnet is the paid path.

The memory ledger remains for unit tests. `POST /api/jobs` in chain mode returns the entry to sign. It does not escrow. `POST /api/jobs/verify` accepts a hire only when the transaction succeeded, the function is `clerk::market::hire` on this package, and the argument is the sha256 of the input. A second `complete` aborts with `E_STATUS`. That abort was observed on testnet for job 1.

The testnet publisher key is not in the repository. The mainnet wallet was not used for these transactions.

- `hire` withdraws the agent's price. The caller does not choose a smaller amount.
- `complete` and `fail` require the agent creator. A second call sees a status other than FUNDED and aborts.
- `refund` requires the payer and the deadline.
- `rate` is one score from the payer after completion. The creator cannot write it.
- `set_fee_bps` is admin-only and capped at 10%. The default is 0.
- `mint_to` is admin-only. There is no public mint.

The process you can run today keeps the same rules in `agents/src/rules.js` and labels the escrow as a local ledger. That ledger is not Supra. Do not treat its balances as coins.

## Reports

- Addresses must be hex, at most 32 bytes.
- A sentence in the input is not an instruction. The detective uses the first token as an address and the balance from the coin store.
- Blockchain sentences are copied from RPC fields and labeled. The analysis line says when no model ran.
- The content agent rearranges existing claims. It does not add a price.
- The cleaner starts with an empty redemption list. An asset not on that list is not offered for burn.
- No agent receives a private key. Trading sets `executes: false`.

## Left open

- Ratings can be farmed by many funded wallets. There is no identity check. The rating count is public so a reader can see a thin sample.
- The resource and transaction calls are first-page reads. A missing page is stated, not filled in.
- A published module ABI can hide a dangerous friend function behind a name this scan does not watch.
- The local ledger has no signature check. Anyone who can call the API can pass any user string. That is acceptable only while the banner says it is not Supra.
- Job reports are gated by an unguessable secret returned once at hire. The secret is in `sessionStorage` on that browser.
- Do not put `CLERK_OPERATOR` or a seed phrase in the repository.
