# DEX integrations

No swap adapter executes.

## What was checked

- Atmos app and guide: https://app.atmos.ag/ and https://knowledge.atmos.ag/user-guides/how-to-use-swap-aggregator. They do not publish a package address or entry function.
- Dexlyn docs and the public Move interface: https://github.com/DexlynLabs/dexlyn_swap_interface. The docs do not pin one mainnet module for Clerk to call.
- WARs DEX: https://dex.supwars.fun/. The swap page does not publish the package or the entry.
- Twelve recent mainnet blocks were read through `https://rpc-mainnet.supra.com`. The user transactions in that window were racing and market-cap calls on `0x343de26e0c49513c9a18a48814786de4c990773fe515fc54c52b0006436dc8d`. No Atmos, Dexlyn, or WARs swap entry appeared. That sample is not a proof those DEXes are unused. It is a proof this build did not observe a swap it can safely name.

Third-party bots that mention `atmos_entry::swap_exact_in_weighted_entry` or a Dexlyn `scripts::swap` were not treated as source of truth.

## Status

| Venue | Package verified from an official source | Quote | Executable swap in Clerk |
|---|---|---|---|
| Atmos | No | No | No |
| Dexlyn | No | No | No |
| WARs | No | No | No |

`compareQuotes` says "best" only among venues that returned `status: "quoted"`. With none quoted, it refuses. `register_watch` stores a limit and does not call a DEX. A conditional buy is not automated: there is no pinned on-chain price and no pinned swap entry, so Automation cannot be aimed at one.
