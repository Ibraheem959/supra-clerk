# Clerk

A desk where someone pays an agent to do a job on Supra.

The token is CLERK. It pays for the job. It is not staked, and it does not promise a yield.

The copy you can run reads Supra for account, resource, transaction, and module data. Job escrow is the Move module published on Supra testnet. See `docs/DEPLOYMENT.md`. A local ledger still exists behind `CLERK_LEDGER=memory` for tests. It is not the paid path.

## Why Supra

Reports call the SupraMVM REST API (chain id 8 on mainnet). The wallet is StarKey (`window.starkey.supra`). The payment rules are a Move module: hire, complete, fail, refund, rate. Expired jobs can be settled by an entry that returns without aborting, which is the shape Supra Automation can call. That task is not registered. dVRF and SupraNova are not used, because this desk does not need randomness or a bridge. Details and the doc pages are in `docs/SUPRA-INTEGRATION.md`.

## Architecture

```
StarKey
  → clerk::market::hire on testnet
  → job FUNDED, CLERK held by the module
Desk
  → verifies the hire transaction
  → reads Supra RPC for the report
Agent creator
  → clerk::market::complete
User
  → one rating, after the job is COMPLETED
```

Large reports stay off-chain. The module stores a 32-byte hash.

## Agents

| Agent | Price | What it does | Permission |
|---|---|---|---|
| Wallet Detective | 50 CLERK | Account, SUPRA coin store, recent transactions | Read |
| Project Research | 150 CLERK | Modules and coin store on one account | Read |
| Contract Risk | 100 CLERK | Public entries in a published ABI | Read |
| Content | 40 CLERK | Posts built only from an existing report | Read |
| Wallet Cleaner | 80 CLERK | Offers a burn only if a redemption is on the verified list. The list ships empty | Approve each asset |
| Trading | 60 CLERK | Compares Atmos, Dexlyn, and WARs. No quote is invented | No transaction is built |
| Portfolio | 70 CLERK | Coin stores the node returned. No profit figure | Read |

A developer can register another agent. The API stores the listing. This process does not call an arbitrary URL for a custom agent.

## Run

```bash
npm test
npm start
npm --prefix frontend install
npm run dev:web
```

Open the Vite URL. Connect StarKey if it is installed. Without it, the desk still explains that the wallet is missing. In chain mode the hire button shows the entry to sign. It does not mark the job paid.

`npm test` reads mainnet and the testnet market, so it needs the network.

`clerk::market` is on Supra testnet at `0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b`. Statuses are FUNDED, COMPLETED, FAILED, and REFUNDED. Mainnet is not claimed.

## Security

Assumptions and the rating limitation are in `docs/SECURITY.md`. DEX sources are in `docs/DEX.md`.
