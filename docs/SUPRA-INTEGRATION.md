# Supra integration

Verified against official docs last updated 17 November 2026.

| Item | Verified value | Where used |
|---|---|---|
| SupraMVM mainnet | Chain id 8, `https://rpc-mainnet.supra.com` | Default read path for reports |
| Testnet | Chain id 6, `https://rpc-testnet.supra.com`, faucet `/rpc/v1/wallet/faucet/<ADDRESS>` | Documented target for a later publish |
| Devnet | Chain id 50, `https://rpc-devnet.supra.com` | Not the default |
| SupraEVM | Devnet only, chain id 535600 | Not used. The market is a Move module |
| REST | `/rpc/v3/accounts/{address}`, `/resources`, `/resources/{type}`, `/transactions`, `/modules/{name}`, `/rpc/v3/transactions/{hash}` | `agents/src/chain.js` |
| Market | Testnet package `0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b::market` | Escrow, agents, jobs. Verified by reading `Registry` after the calls in `docs/DEPLOYMENT.md` |
| Automation | `settle_expired` is deployed and callable. It was not registered | A block-end task would pay gas to return until a job is due |
| dVRF | Documented. Not used | Payments do not need randomness |
| SupraNova | Testnet bridge exists. Not used | No agent moves assets across chains |
| DEX | Atmos, Dexlyn, WARs were not pinned from official sources or from the blocks that were read | `docs/DEX-INTEGRATIONS.md` |
| OpenAPI | `https://rpc-mainnet.supra.com/docs/api.json` | Paths confirmed before coding |
| SDK | `supra-ts-sdk`, dist-tags `mainnet` / `testnet` / `devnet` | Not bundled. StarKey signing follows the dapp guide when a market address exists |
| StarKey | `window.starkey.supra.connect`, `.account`, `.changeNetwork({chainId})`, `.sendTransaction` | `frontend/src/App.jsx` |
| Raw transaction | SDK `transaction.build.rawTxnObject`, then `sendTransaction({ data, from, to: "", value: "", chainId })` | Not sent until `CLERK_MARKET_ADDRESS` is set. The guide marks `createRawTransactionData` deprecated |
| Fungible asset | `supra_framework::fungible_asset` (`0x1`) | Not the payment asset. Payment uses a coin so escrow is `Coin<CLERK>` |
| Coin | `0x1::coin::CoinStore<0x1::supra_coin::SupraCoin>` returns `data.coin.value` in quants (1 SUPRA = 1e8) | Balance reads |
| Automation | `supra move automation register` calls an entry at the end of each block. Condition belongs inside the function. Registration fee is not refunded | `settle_expired` returns without aborting when the job is not due. It is not registered |
| dVRF | Documented for Supra mainnet and testnet. Not required for payments, ratings, or reports | Not used |
| SupraNova | Testnet quickstart bridges from Sepolia to SupraMVM testnet (chain id 6) via the token bridge | Not implemented. No agent bridges assets |
| AI agent guide | Official sample uses the TypeScript SDK for balance, faucet, history, resources | Clerk uses the REST API directly so a report does not need a funded signer |

## What is actually called

- Account, resources, SUPRA coin store, transaction page, and module ABI are read from the RPC.
- `clerk::market` on testnet holds the escrow. The desk verifies a hire transaction before it writes a report. It does not settle the job itself.
- StarKey is the signer. The browser is not given a key.

## What was not invented

- No Automation registration was sent.
- No dVRF callback was added.
- No SupraNova transfer is built.
- No DORA price is attached to a portfolio. The docs describe push feeds; this desk does not pin a feed address it has not called.
- DEX entry functions are not guessed. See `docs/DEX.md`.
