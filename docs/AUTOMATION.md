# Automation

Registered on Supra testnet. Not observed executing.

| | |
|---|---|
| Task index | 6474 |
| Target | `0xf41a860dbbdba930321379a9b3cd15c05df971f6830158f9e06b2c44b5ae1f8b::market::settle_expired` |
| Argument | job 2 |
| Registration | `0x7d539248bfa6160847e11258d819ca5495a79d9804f1674b336d685fb914d367` |
| Simulation | The same payload with `--simulate` returned `Executed successfully` and was not on chain (`0x8fa548…` 404). |
| Fee locked | 10 SUPRA (`1000000000` quants) plus a 0.5 SUPRA registration fee, from the testnet profile |
| Expiry | `1795453498` |

Job 2 was hired after `set_review_secs(90)` (`0xfd3ae6e76cce830306a44a7b43691aab8049e0725bbd484d2991eeb1ffacf746`). Its deadline was `1795446362`. Chain time `1795446476` was already past that deadline, and the job status was still `1` (FUNDED). No `settle_expired` transaction was in the publisher's recent history. The task is registered. It has not been shown to refund the job.

`cancel_task` was not called, so the task can still run. It was not cancelled because cancelling it would remove the only chance to observe it.

Conditional trading was not registered. There is no pinned price resource to compare inside a Move function, and no swap was executed.
