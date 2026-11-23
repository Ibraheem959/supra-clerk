# Deployment

Published on SupraMVM testnet. Not on mainnet.

| | |
|---|---|
| Network | Testnet |
| Chain id | 6 |
| RPC | `https://rpc-testnet.supra.com` |
| Package address | `0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b` |
| Module | `clerk::market` |
| Publish transaction | `0x861311d47a63dc896f00f9ec7af3c701001e2b7ec292434ab804eed611721281` |
| Explorer | https://testnet.suprascan.io/address/0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b |

The publish transaction status was `Success`, gas used 5840, and the node returned the module ABI with `hire`, `complete`, `fail`, `refund`, `settle_expired`, and the views.

## Live calls after publish

| Transaction | Function | Result |
|---|---|---|
| `0x1e9f0f7765e5e6256362ce9c756a474ee36cb442a3cc04dda7bd756d804c428a` | `mint_to` | Success |
| `0xf5be8e2f5f4efab38c29d60f7c82c3a3dc6e6d09d755e7e29a7dccb9bbb67e8b` | `register_agent` | Success. Wallet Detective, 50 CLERK |
| `0xc530070ec4d047de7f51f3e5a2c408ac38d3f700aec285f91a4167580aaa473b` | `hire` | Success. Job 1 funded |
| `0xae7a83a1ae2949fdc44f3c2643be1ceaa11c288a5fc800cd29d6aaf9953e8bc7` | `complete` | Success. `Settled` status 2, 50 CLERK deposited to the creator |
| second `complete` of job 1 | `complete` | Aborted `E_STATUS(0x5)` |

`job_status(1)` returned 1 before complete and 2 after. The six other agents were registered in later transactions. `Registry` on the account lists seven agents. Fee is 0.

The mainnet development wallet was not used. Its address is on chain id 8 and it was left alone. The testnet publisher was a new profile, funded from the testnet faucet (`0xb0a6ac3f2ef5488d1a09889e22defc0f39349644cce5c0a3c8d649abb818ca2f`). The key is not in this repository.

## Automation

`settle_expired` is on the module. It was not registered. A registered task runs at the end of blocks, the registration fee is not refunded, and the only live job has about 48 hours left. Registering it now would pay gas to return immediately. Move tests already cover the refund after the deadline.

## Upgrade and the short job

`set_review_secs` was added and published as a compatible upgrade: `0x7b125b5bddb9d92ed18194bd3d8424cd74796867b88a766519118be18a6a860c`. `upgrade_number` is 1. Policy remains 1 (compatible).

Job 2 is a Content hire with a 90 second review. Automation task 6474 targets `settle_expired` for that job. Registration `0x7d539248bfa6160847e11258d819ca5495a79d9804f1674b336d685fb914d367`. Execution was not observed. Details are in `docs/AUTOMATION.md`.

## Public site

One Render web service is enough. `yarn start` builds `frontend/` when `frontend/dist` is missing, then `agents/src/server.js` serves that desk at `/` and the JSON API at `/api`. Do not set `CLERK_LEDGER=memory` on Render. The market address stays the published testnet package.

