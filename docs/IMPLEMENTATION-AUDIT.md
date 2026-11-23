# Implementation audit

## Works on testnet

- `clerk::market` at `0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b`, chain id 6.
- Publish, upgrade (`0x7b125b5bddb9d92ed18194bd3d8424cd74796867b88a766519118be18a6a860c`, policy compatible), `mint_to`, `register_agent`, `hire`, `complete`.
- A second `complete` of job 1 aborted with `E_STATUS`.
- Seven agents are in `Registry`.
- `set_review_secs` is on chain. Job 2 was created with a 90 second review.
- Automation task 6474 is registered. See `AUTOMATION.md`. It has not been observed executing.
- Wallet reads use the Supra RPC. Transaction history pages with `count` and `start=<oldest sequence - 1>`.
- The public desk reads the registry and will run an agent only after a successful `hire` whose argument is the sha256 of the input.

## Not live

- Atmos, Dexlyn, and WARs swaps. Packages for the first two are identified. No swap transaction exists. See `TRADING.md`.
- Burn-for-SUPRA. No mechanism was verified. See `WALLET-CLEANER.md`.
- A custom agent endpoint. The desk does not call an arbitrary URL.
- SupraNova. Testnet docs describe Sepolia and SupraEVM routes. No bridge call was made, so no cross-chain agent is offered.
- dVRF. Jobs do not need randomness.
- Mainnet market. Not deployed. The mainnet development wallet was not spent.

## Preserved

The memory ledger remains behind `CLERK_LEDGER=memory` for unit tests. It is not the path the desk uses.
