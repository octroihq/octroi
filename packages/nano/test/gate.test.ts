/**
 * The adapter behind a real `Gate`: challenge, pay, replay, underpay — the
 * same pipeline a merchant runs, with the node faked from recorded replies.
 */
import {
  RECEIPT_HEADER,
  createGate,
  readErrorDetail,
  verifyReceipt,
  type ChallengeBody,
  type GateOptions,
  type GateRequest,
  type PaymentPayload,
} from "@octroi/core";
import { counterIds, encodePaymentHeader } from "@octroi/core/testing";
import { describe, expect, it } from "vitest";
import { NANO_MAINNET, nanoFacilitator, xnoToRaw } from "../src/index.js";
import { PAY_TO, PAYER, SEND, SEND_AMOUNT, SEND_SEEN_MS, fakeNode } from "./node.js";

const NOW = SEND_SEEN_MS + 3_000;

function gate(overrides: Partial<GateOptions> = {}, node = fakeNode()) {
  const ids = counterIds();
  return createGate({
    price: xnoToRaw("50"),
    asset: "xno",
    decimals: 30,
    network: NANO_MAINNET,
    payTo: PAY_TO,
    facilitator: nanoFacilitator({ rpcUrl: "https://node.example/rpc", fetchImpl: node.fetch }),
    clock: () => NOW,
    newNonce: () => "nonce-1",
    newId: (prefix) => ids(prefix),
    ...overrides,
  });
}

const request = (headers: Record<string, string> = {}): GateRequest => ({
  method: "GET",
  route: "/v1/report",
  url: "https://api.example.com/v1/report",
  headers,
});

const payment: PaymentPayload = {
  x402Version: 1,
  scheme: "exact",
  network: NANO_MAINNET,
  payload: { blockHash: SEND.hash },
};
const paid = () => request({ "X-PAYMENT": encodePaymentHeader(payment) });

describe("a Gate priced in XNO", () => {
  it("challenges with a nano:mainnet entry, priced in raw", async () => {
    const result = await gate().handle(request());
    expect(result.type).toBe("challenge");
    if (result.type === "pass") return;
    const body = result.body as ChallengeBody;
    expect(body.accepts).toEqual([
      expect.objectContaining({
        scheme: "exact",
        network: "nano:mainnet",
        maxAmountRequired: SEND_AMOUNT.toString(),
        payTo: PAY_TO,
        asset: "XNO",
      }),
    ]);
    expect(readErrorDetail(body)?.message).toBe(`This route costs 50.${"0".repeat(30)} XNO.`);
  });

  it("serves a request paid with a confirmed send, and signs a receipt for it", async () => {
    const g = gate();
    const result = await g.handle(paid());
    expect(result.type).toBe("pass");
    if (result.type !== "pass" || !result.receipt) throw new Error("expected a paid pass");
    expect(result.payer).toBe(PAYER);
    expect(result.headers[RECEIPT_HEADER]).toBe(result.receiptId);
    expect(result.receipt).toMatchObject({
      network: "nano:mainnet",
      asset: "xno",
      amount: SEND_AMOUNT.toString(),
      tx_ref: SEND.hash,
      payer: PAYER,
    });
    expect(await verifyReceipt(result.receipt, await g.publicKey())).toBe(true);
  });

  it("burns the block: the same payment cannot pay twice", async () => {
    const g = gate();
    expect((await g.handle(paid())).type).toBe("pass");
    const again = await g.handle(paid());
    expect(again.type).toBe("reject");
    if (again.type !== "pass") expect(again.code).toBe("replay");
  });

  it("refuses a block that moved less than the route costs", async () => {
    const result = await gate({ price: xnoToRaw("50.000001") }).handle(paid());
    expect(result.type).toBe("reject");
    if (result.type !== "pass") expect(result.code).toBe("wrong_amount");
  });

  it("answers 503 under fail_closed when the node cannot be reached", async () => {
    const node = fakeNode({ [SEND.hash]: { status: 503, text: "" } });
    const result = await gate({}, node).handle(paid());
    expect(result.type).toBe("error");
    if (result.type !== "pass") expect(result.status).toBe(503);
  });
});
