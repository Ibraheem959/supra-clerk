# Integrations

The desk reads Supra nodes. A missing credential stays missing. Nothing below is filled with a sample number.

| Integration | Provider | Network | Credential | Status |
|---|---|---|---|---|
| Account, modules, resources, sent transactions | Supra REST `/rpc/v3` | Testnet chain 6 | None | Working |
| Coin transaction feed | `coin_transactions` plus `x-supra-cursor` | Testnet | None | Working. An empty page does not end the feed |
| Automated transactions | `automated_transactions` | Testnet | None | Working. Execution of task 6474 was not observed |
| Move view | `POST /rpc/v3/view` | Testnet | None | Working. `automation_registry::get_task_count` returned 0 |
| Account history | `/accounts/{address}/history` | Devnet from node v12 | None | Testnet returned 404 |
| StarKey | `window.starkey.supra` | Testnet chain 6 | Browser wallet | Connect and send exist. This server cannot sign |
| Marketplace | `clerk::market` | Testnet package `0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b` | Not replaced | Hire, complete, and one rating per completed job are in the contract |
| Price feeds | `https://prod-kline-rest.supra.com` | Early access | `SUPRA_PRICE_API_KEY` | Not configured. Reports say PRICE UNAVAILABLE |
| Language model | OpenAI-compatible `LLM_BASE_URL` | Off-chain | `LLM_API_KEY`, optional `LLM_MODEL` | Not configured. A model that adds a number is discarded |
| dVRF, SupraNova, SupraEVM | — | — | — | Not used. No button claims them |

Ratings: `rate` requires the hiring account, a completed job, and `rated == false`. A second wallet can still hire and rate. One human cannot be enforced on chain.

Custom agents: a listing can be registered with `register_agent`. This server does not run an arbitrary URL. An untrusted endpoint is not given a key, a seed, or a way to send a transaction.

## Price feeds

Status: BLOCKED — credential required.

Required variable: `SUPRA_PRICE_API_KEY`.

How to obtain: request access on the Supra price-feed form at the official docs, `https://docs.supra.com/oracles/apis-real-time-and-historical-data/rest-api`. The host is `https://prod-kline-rest.supra.com`.

What still works: balances and coin movement.

What stays blocked: any dollar value.

## Language model

Status: NOT CONFIGURED.

Required variables: `LLM_API_KEY`, optional `LLM_MODEL`, optional `LLM_BASE_URL` (defaults to `https://api.openai.com/v1`).

What still works: sentences assembled from the tool results.

What stays blocked: a model rewrite. No model call is pretended.

## Trading

Feature: a swap on Dexlyn or Atmos.

Status: BLOCKED.

What was verified on 27 Nov 2026:

- Dexlyn testnet package `0x4496a672452b0bf5eff5e1616ebfaf7695e14b02a12ed211dd4f28ac38a5d54c` publishes `scripts::swap`.
- That entry takes a signer, two `u64` values, and three type arguments.
- `factory::Pools` is a table handle `0xbe10474f38096fa9d8df4398ef0216fd896861c98806412aa70c33beba00259e`, not a list of reserves.
- Atmos package `0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234` has modules on mainnet, including `atmos_entry::swap_exact_in_weighted_entry`. The same address has no modules on testnet.
- No WARs package was found.

Why it cannot execute: a quote needs the pool reserves, and those are not in the resource body. Guessing the three type arguments or the two numbers would invent a swap.

What is required: a verified way to read one pool's reserves, then a testnet swap whose output matches that quote.

Exact next step: read the Dexlyn table item for a known pair, or use an official Dexlyn quote function if one is published.

## Automation

Feature: Supra Automation calling `clerk::market::settle_expired`.

Status: NOT VERIFIED.

What was verified: `0x1::automation_registry::get_task_count` returns `0`. `get_task_details` for task `6474` aborts. The earlier registration transaction did not leave a task in the registry, and no execution transaction was found.

Why it is not called working: registration alone is not execution.

What is required: a new short-lived funded job, a registered task, and a later transaction that changes that job to refunded. That spend was not made in this pass.
