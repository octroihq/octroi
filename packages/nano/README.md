# `@octroi/nano`

A Nano (XNO) adapter: `nano:mainnet`, native XNO, verified against a Nano node.
It sits beside `@octroi/coinbase` — same `FacilitatorAdapter` contract, same
gate, receipts and replay store — for merchants who also want to take a
payment that has no facilitator, no fee and no account behind it.

## Use

```ts
import { createGate } from "@octroi/core";
import { nanoFacilitator, xnoToRaw } from "@octroi/nano";

const xnoGate = createGate({
  price: xnoToRaw("0.001"),     // raw, a bigint: 1 XNO = 10^30 raw
  asset: "xno",
  decimals: 30,
  network: "nano:mainnet",
  payTo: process.env.NANO_ADDRESS!, // nano_…, checked by checksum
  facilitator: nanoFacilitator({ rpcUrl: "https://your-node.example/rpc" }),
});
```

`registerNanoFacilitator({ rpcUrl })` registers the same adapter under the id
`"nano"`, so `facilitator: "nano"` resolves by string.

## How a payment works

1. The 402 advertises `{ scheme: "exact", network: "nano:mainnet", asset: "XNO",
   maxAmountRequired: "<raw>", payTo: "nano_…" }`.
2. The payer publishes a send block for that amount to `payTo` with their own
   wallet, then retries with an `X-PAYMENT` payload of exactly
   `{ "blockHash": "<64 uppercase hex>" }`.
3. `verify()` calls the node's `block_info` and accepts the block only if it is
   **confirmed**, is a **send** (a receive, open or change block is refused
   however well its amount matches), paid **`payTo`** (the block's
   `link_as_account`, or `destination` on a legacy send — never
   `block_account`, which is the payer), and was first seen by the node within
   `maxBlockAgeSeconds`. It returns the amount the block actually moved, and
   core refuses an underpayment as `wrong_amount`.
4. Core burns the payload hash and `tx:nano:mainnet:<blockHash>` as for any
   other adapter.

Nothing is signed, published or held by the adapter. It only reads.

## Things worth knowing

**Give XNO its own gate.** A gate has one asset and one price, so USDC and XNO
cannot share one in any case. It matters for clients too: as `PROTOCOL.md` §1
records, `x402-fetch@1.2.0` parses every `accepts` entry against a closed
network enum, so a `nano:mainnet` entry in a USDC route's challenge would stop
that client paying even in USDC. Run the XNO gate on its own route (or pick the
gate per request) beside your existing one.

**Price in raw.** Core reads a *string* price as US dollars. An XNO price goes
in as a bigint of raw — `xnoToRaw("0.001")`, which refuses a float, an exponent
or a 31st decimal place rather than rounding.

**The age window is the expiry.** A Nano block never lapses on its own, so
without a window a burned block hash would pay again the moment the replay
store forgot it. `maxBlockAgeSeconds` (default 600) refuses older blocks as
`expired`; keep the gate's `replayTtlMs` above it (the default 15 minutes is).
A block the node has no timestamp for is refused the same way.

**Unconfirmed is retriable.** A block the node has not confirmed yet is refused
as `invalid_payment` without burning anything; Nano confirms in about a second,
so the payer's retry normally passes.

**Outages are exceptions, never verdicts.** A non-200 answer, a non-JSON body,
JSON that is not a `block_info` reply, a node error other than
`Block not found`, a timeout or a refused connection all throw
`FacilitatorUnreachableError`, so your `mode` decides — rather than refusing a
payment that may well have settled.

**A block hash is public once it is published.** Whoever presents a qualifying
send first gets the request it pays for. That is the same property as any
push payment that carries no server nonce; if a route's response is worth more
than the race, bind the response to the payer (`result.payer`) yourself.
