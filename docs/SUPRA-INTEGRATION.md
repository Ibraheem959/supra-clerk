# Supra integration

Verified against official docs last updated 17 November 2026.

| Item | Verified value | Where used |
|---|---|---|
| SupraMVM mainnet | Chain id 8, `https://rpc-mainnet.supra.com` | Default read path for reports |
| Testnet | Chain id 6, `https://rpc-testnet.supra.com`, faucet `/rpc/v1/wallet/faucet/<ADDRESS>` | Documented target for a later publish |
| Devnet | Chain id 50, `https://rpc-devnet.supra.com` | Not the default |
| SupraEVM | Devnet only, chain id 535600 | Not used. The market is a Move module |
| REST | `/rpc/v3/accounts/{address}`, `/resources`, `/resources/{type}`, `/transactions`, `/modules/{name}`, `/rpc/v3/transactions/{hash}` | `agents/src/chain.js` |
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

- Account, resources, SUPRA coin store, transaction page, and module ABI are read from the RPC above.
- The Move module `clerk::market` is the payment and reputation contract. It is in `contracts/` and is not published.
- StarKey is the wallet. The running desk does not submit a market transaction because there is no published address.

## What was not invented

- No Automation registration was sent.
- No dVRF callback was added.
- No SupraNova transfer is built.
- No DORA price is attached to a portfolio. The docs describe push feeds; this desk does not pin a feed address it has not called.
- DEX entry functions are not guessed. See `docs/DEX.md`.
