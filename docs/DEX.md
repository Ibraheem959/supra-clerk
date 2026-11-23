# DEX venues

Checked before any swap code was written.

## Atmos

- Official app: https://app.atmos.ag/
- Official guide: https://knowledge.atmos.ag/user-guides/how-to-use-swap-aggregator
- StarKey is the wallet. Swaps are aggregated across pools.
- No official package address or `swap_exact_in` entry was published on that guide.
- Third-party bots that name `atmos_entry::swap_exact_in_weighted_entry` were not treated as source of truth.

## Dexlyn

- Official docs: https://docs.dexlyn.com/dex/token-swap
- Official Move interface: https://github.com/DexlynLabs/dexlyn_swap_interface
- The docs describe an API-routed swap and concentrated liquidity. They do not publish one mainnet module address for Clerk to call.
- A third-party script naming `router::get_amount_out` and `scripts::swap` was not pinned.

## WARs DEX

- Official app: https://dex.supwars.fun/
- Swaps go from the wallet through pools. Slippage is shown. A Floor pool can charge its fee in SUPRA.
- The public page does not publish the package address or the entry function.

## What Clerk does

`agents/src/agents/trader.js` keeps three adapters in one comparison.

A venue counts only when a quote has `status: "quoted"` and an output amount. Until an official entry and quote are pinned in configuration, all three return `not_verified`. The preview says best price is not claimed, builds no transaction, and sets `executes: false`.

A user phrase such as "buy 100 SUPRA of X" is not executed. The next step, after a venue is pinned, is a StarKey preview: from, to, venue, minimum, slippage. The signer is the user. Clerk does not hold a key.

Supra Automation is the wrong tool for these swaps today. An automated buy needs a verified on-chain price and a verified DEX entry. Neither is pinned. `register_watch` only stores a limit the user signed. It does not call a DEX.
