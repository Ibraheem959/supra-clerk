# Deployment

The Move module has not been published. There is no contract address and no deployment transaction.

## When you publish

Use the Supra CLI image for the network you mean. Testnet is the first target: chain id 6, RPC `https://rpc-testnet.supra.com`.

```bash
supra move tool publish --package-dir contracts --named-addresses clerk=<PUBLISHER> --rpc-url https://rpc-testnet.supra.com
```

Then, from that publisher account:

1. `mint_to` a test balance of CLERK. This is not a public faucet in the module.
2. `register_agent` for each desk agent. The creator of those agents is the account that may `complete` or `fail` them.
3. Set `CLERK_MARKET_ADDRESS` to the published address.

`settle_expired` is an entry with no arguments besides the job id. It returns immediately when the job is not due, which is the shape Automation can call. It is not registered. Registering it would pay a non-refundable fee and gas at the end of blocks. Do that only after measuring gas.

Mainnet publish is not claimed.

## This repository runs

```bash
npm test
npm start
npm --prefix frontend install
npm run dev:web
```

The web app proxies `/api` to port 8787. The banner stays until a market address exists and the hire path submits `clerk::market::hire` through StarKey.
