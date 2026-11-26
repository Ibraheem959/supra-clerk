# Integrations

The desk reads Supra nodes. A missing credential stays missing. Nothing below is filled with a sample number.

| Integration | Provider | Network | API or SDK | Credential | Status | Evidence |
|---|---|---|---|---|---|---|
| Account, modules, resources, sent transactions | Supra REST `/rpc/v3` | Testnet chain 6, also readable on mainnet | Node REST | None | Implemented | Used by every investigation |
| Coin transaction feed | `GET /rpc/v3/accounts/{address}/coin_transactions` | Testnet and mainnet | `x-supra-cursor` | None | Implemented | Pages continue while the cursor is present, including an empty page |
| Automated transactions | `GET /rpc/v3/accounts/{address}/automated_transactions` | Testnet | Same cursor | None | Implemented | An empty cursor ends the feed |
| Move view | `POST /rpc/v3/view` | Testnet | JSON view | None | Implemented | `0x1::timestamp::now_microseconds` returned; `0x1::automation_registry::get_task_count` returned `0` |
| Account history | `GET /rpc/v3/accounts/{address}/history` | Devnet nodes from v12 | REST | None | Not available | Testnet answered 404 on 26 Nov 2026 |
| StarKey | `window.starkey.supra` | Testnet chain 6 | Wallet extension | None | Implemented | Connect, disconnect, and `sendTransaction` |
| Move package | `clerk::market` | Testnet | Package `0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b` | Publisher key, not in the repo | Live, not replaced | Hire and complete transactions from earlier deployment |
| Automation registry | `0x1::automation_registry` | Testnet | View | None | Readable, execution not proven | `get_task_count` is `0`. `get_task_details` for task `6474` aborts. The old task is not in the registry |
| Price feeds | `https://prod-kline-rest.supra.com` | Early access | `GET /latest`, `GET /history` | `SUPRA_PRICE_API_KEY` | Not configured | Reports say `PRICE: UNAVAILABLE` |
| Language model | OpenAI-compatible `LLM_BASE_URL` | Off-chain | `/chat/completions` | `LLM_API_KEY`, optional `LLM_MODEL` | Not configured | Content is assembled from the facts. A configured model is rejected if it adds a number |
| Atmos, Dexlyn, WARs | On-chain packages where known | Testnet or mainnet as previously checked | Entry functions | None | Not executable | No quote was derived and no swap is built |
| dVRF | Supra dVRF | Not called | — | — | Not implemented | The agents do not need randomness |
| SupraNova / SupraEVM | Bridge and EVM | Not called | — | — | Not implemented | No bridge button and no transfer hash |

`LLM_API_KEY` is read only on the server. It is never sent to the browser.
