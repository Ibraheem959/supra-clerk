# Trading

No swap was executed. No quote was returned. The desk does not say "best route".

| Venue | Package | Entry | Network checked | Executed |
|---|---|---|---|---|
| Atmos | `0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234` | `atmos_entry::swap_exact_in_weighted_entry` and the stable/out variants | Mainnet modules exist. Testnet account has no modules. | No. A mainnet swap was not sent. |
| Dexlyn | Testnet `0x4496a672452b0bf5eff5e1616ebfaf7695e14b02a12ed211dd4f28ac38a5d54c`. Mainnet `0x0dc694898dff98a1b0447e0992d0413e123ea80da1021d464a4fbaf0265870d8` | `scripts::swap`, `swap_into`, `swap_unchecked`. Each takes `&signer`, `u64`, `u64` and three type arguments. | Testnet `scripts` ABI was read. | No. A pool's coin types were not replayed from a successful swap, so the arguments were not guessed. |
| WARs | Not found | `wars_pool::swap_exact_in` is named at https://dex.supwars.fun/audit without a hex package | Not probed | No |

Sources: Atmos knowledge base liquidity-pool and coin-entry pages. Dexlyn `DexlynLabs/dexlyn_swap_interface` Move.toml and the live module ABI.
