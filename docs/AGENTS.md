# Agents

Prices are the on-chain values in the testnet registry. They change only through `set_agent_price` by the creator.

| Agent | Price | Execution | Permission |
|---|---|---|---|
| Wallet Detective | 50 CLERK | Reads the account, SUPRA coin store, and a page of transactions. Every figure comes from the RPC. | Read |
| Project Research | 150 CLERK | Reads modules and the SUPRA coin store. Omits holders and price when the node did not return them. | Read |
| Contract Risk | 100 CLERK | Lists public entry names in the published ABI. A matching name is a signal, not a proof. | Read |
| Content | 40 CLERK | Rearranges claims that are already in a report. | Read |
| Wallet Cleaner | 80 CLERK | Lists resources. A burn is offered only if the type is on the verified redemption list. The list is empty. | No transaction is built |
| Trading | 60 CLERK | Compares Atmos, Dexlyn, and WARs only when a quote is actually returned. None is pinned, so it does not trade. | No transaction is built |
| Portfolio | 70 CLERK | Reads coin stores. No profit figure. | Read |

A creator can register another agent with `register_agent`. This process does not call an arbitrary URL for a custom agent.

Read-only agents never receive a key. Action agents stop at a preview. The user signs in StarKey, or nothing is sent.
