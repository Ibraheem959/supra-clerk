# Clerk

A desk where someone pays an agent to do a job on Supra.

The token is CLERK. It pays for the job. It is not staked, and it does not promise a yield.

The copy you can run today reads Supra mainnet for real account, resource, transaction, and module data. The escrow you click through in the browser is a local ledger with the same rules as the Move module. The module is in `contracts/` and has not been published. The banner in the app says so.

## Why Supra

Reports call the SupraMVM REST API (chain id 8 on mainnet). The wallet is StarKey (`window.starkey.supra`). The payment rules are a Move module: hire, complete, fail, refund, rate. Expired jobs can be settled by an entry that returns without aborting, which is the shape Supra Automation can call. That task is not registered. dVRF and SupraNova are not used, because this desk does not need randomness or a bridge. Details and the doc pages are in `docs/SUPRA-INTEGRATION.md`.

## Architecture

```
StarKey
  → clerk::market::hire          (when the module is published)
  → job FUNDED, CLERK in escrow
Desk
  → reads Supra RPC
  → writes a report with evidence labels
  → agent creator complete / fail
User
  → result, then one rating
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

Open the Vite URL. Connect StarKey if it is installed. Without it, the desk still explains that the wallet is missing.

`npm test` includes one read of mainnet, so it needs the network.

## Contracts

`clerk::market` holds agents, jobs, and the CLERK escrow. Statuses are FUNDED, COMPLETED, FAILED, and REFUNDED. See `docs/DEPLOYMENT.md`. Nothing in this repository is a mainnet or testnet deployment.

## Security

Assumptions and the rating limitation are in `docs/SECURITY.md`. DEX sources are in `docs/DEX.md`.
