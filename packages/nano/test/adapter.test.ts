import {
  FacilitatorUnreachableError,
  formatConformance,
  runFacilitatorConformance,
  silentLogger,
  type ChallengeRequest,
  type PaymentPayload,
  type VerifyContext,
  type VerifyResult,
} from "@octroi/core";
import { describe, expect, it } from "vitest";
import { NANO_MAINNET, XNO_ASSET_CODE, nanoFacilitator } from "../src/index.js";
import {
  LEGACY_SEND,
  NOT_FOUND,
  PAYER,
  PAY_TO,
  RECEIVE,
  SEND,
  SEND_AMOUNT,
  SEND_SEEN_MS,
  fakeNode,
  sendWith,
} from "./node.js";

const RPC = "https://node.example/rpc";

const requirements: ChallengeRequest = {
  route: "/v1/report",
  resource: "https://api.example.com/v1/report",
  description: "Access to /v1/report",
  mimeType: "application/json",
  network: NANO_MAINNET,
  asset: "xno",
  amount: SEND_AMOUNT,
  payTo: PAY_TO,
  nonce: "nonce-1",
  expiresAt: SEND_SEEN_MS / 1_000 + 120,
  maxTimeoutSeconds: 120,
};

function adapter(node = fakeNode(), options: Partial<Parameters<typeof nanoFacilitator>[0]> = {}) {
  return nanoFacilitator({ rpcUrl: RPC, fetchImpl: node.fetch, ...options });
}

function ctx(overrides: Partial<VerifyContext> = {}): VerifyContext {
  const req = { ...requirements, ...(overrides.requirements ?? {}) };
  return {
    scheme: adapter().buildChallenge(req),
    requirements: req,
    route: req.route,
    now: SEND_SEEN_MS + 5_000,
    signal: new AbortController().signal,
    logger: silentLogger,
    ...overrides,
  };
}

const pay = (blockHash: unknown, extra: Record<string, unknown> = {}): PaymentPayload => ({
  x402Version: 1,
  scheme: "exact",
  network: NANO_MAINNET,
  payload: { blockHash, ...extra },
});

function rejected(result: VerifyResult) {
  if (result.ok) throw new Error("expected a rejection");
  return result;
}

describe("nanoFacilitator construction", () => {
  it("needs an http(s) rpcUrl and a positive block-age window", () => {
    expect(() => nanoFacilitator({ rpcUrl: "" })).toThrow(/rpcUrl/);
    expect(() => nanoFacilitator({ rpcUrl: "node.example" })).toThrow(/rpcUrl/);
    expect(() => nanoFacilitator({ rpcUrl: RPC, maxBlockAgeSeconds: 0 })).toThrow(/maxBlockAgeSeconds/);
  });

  it("advertises nano:mainnet only", () => {
    expect(adapter().id).toBe("nano");
    expect(adapter().networks).toEqual(["nano:mainnet"]);
  });
});

describe("buildChallenge", () => {
  it("advertises an exact XNO payment in raw to payTo", () => {
    expect(adapter().buildChallenge(requirements)).toEqual({
      scheme: "exact",
      network: "nano:mainnet",
      maxAmountRequired: "50000000000000000000000000000000",
      resource: requirements.resource,
      description: requirements.description,
      mimeType: "application/json",
      payTo: PAY_TO,
      maxTimeoutSeconds: 120,
      asset: XNO_ASSET_CODE,
      extra: null,
    });
  });

  it("refuses a payTo that fails the checksum, rather than advertising it", () => {
    const typo = `${PAY_TO.slice(0, -1)}${PAY_TO.endsWith("1") ? "3" : "1"}`;
    expect(() => adapter().buildChallenge({ ...requirements, payTo: typo })).toThrow(/not a valid Nano address/);
    expect(() => adapter().buildChallenge({ ...requirements, payTo: `0x${"1".repeat(40)}` })).toThrow(
      /not a valid Nano address/,
    );
  });

  it("refuses an asset other than XNO and a network other than nano:mainnet", () => {
    expect(() => adapter().buildChallenge({ ...requirements, asset: "usdc" })).toThrow(/only settles XNO/);
    expect(() => adapter().buildChallenge({ ...requirements, network: "base" })).toThrow(/does not support/);
  });
});

describe("verify against recorded node replies", () => {
  it("accepts a confirmed state send that paid payTo, and reports what it moved", async () => {
    const node = fakeNode();
    const result = await adapter(node).verify(pay(SEND.hash), ctx());
    expect(result).toMatchObject({ ok: true, txRef: SEND.hash, settledAmount: SEND_AMOUNT, payer: PAYER });
    expect(node.requests).toEqual([{ action: "block_info", json_block: "true", hash: SEND.hash }]);
  });

  it("matches payTo by account, so the legacy xrb_ spelling of it also verifies", async () => {
    const legacy = PAY_TO.replace("nano_", "xrb_");
    const result = await adapter().verify(pay(SEND.hash), ctx({ requirements: { ...requirements, payTo: legacy } }));
    expect(result.ok).toBe(true);
  });

  it("reads the payee of a pre-state send from contents.destination", async () => {
    const reply = LEGACY_SEND.reply;
    const result = await adapter().verify(
      pay(LEGACY_SEND.hash),
      ctx({
        requirements: { ...requirements, payTo: reply.contents.destination },
        now: Number(reply.local_timestamp) * 1_000 + 1_000,
      }),
    );
    expect(result).toMatchObject({ ok: true, settledAmount: BigInt(reply.amount), payer: reply.block_account });
  });

  it("refuses a receive block however well its amount matches", async () => {
    const result = rejected(
      await adapter().verify(
        pay(RECEIVE.hash),
        ctx({ requirements: { ...requirements, payTo: RECEIVE.reply.block_account } }),
      ),
    );
    expect(result.code).toBe("invalid_payment");
    expect(result.message).toMatch(/receive, not a send/);
  });

  it("refuses a send that paid someone else", async () => {
    const result = rejected(
      await adapter().verify(pay(SEND.hash), ctx({ requirements: { ...requirements, payTo: PAYER } })),
    );
    expect(result.code).toBe("invalid_payment");
    expect(result.message).toMatch(/did not pay/);
  });

  it("refuses a block the node does not have", async () => {
    const result = rejected(await adapter().verify(pay(NOT_FOUND.hash), ctx()));
    expect(result.code).toBe("invalid_payment");
  });

  it("refuses an unconfirmed block as retriable, not as an outage", async () => {
    const node = fakeNode({ [SEND.hash]: sendWith({ confirmed: "false" }) });
    const result = rejected(await adapter(node).verify(pay(SEND.hash), ctx()));
    expect(result.code).toBe("invalid_payment");
    expect(result.message).toMatch(/not confirmed yet/);
  });

  it("refuses a block older than the window, so a burned hash cannot come back after the store forgets it", async () => {
    const old = ctx({ now: SEND_SEEN_MS + 601_000 });
    expect(rejected(await adapter().verify(pay(SEND.hash), old)).code).toBe("expired");
    // Inside a wider window the same block is fine.
    expect((await adapter(fakeNode(), { maxBlockAgeSeconds: 900 }).verify(pay(SEND.hash), old)).ok).toBe(true);
  });

  it("refuses a block the node has no timestamp for", async () => {
    const node = fakeNode({ [SEND.hash]: sendWith({ local_timestamp: "0" }) });
    expect(rejected(await adapter(node).verify(pay(SEND.hash), ctx())).code).toBe("expired");
  });

  it("returns the amount actually moved, so core can refuse an underpayment", async () => {
    const node = fakeNode({ [SEND.hash]: sendWith({ amount: "1" }) });
    expect(await adapter(node).verify(pay(SEND.hash), ctx())).toMatchObject({ ok: true, settledAmount: 1n });
  });
});

describe("payload shape", () => {
  it("accepts only { blockHash } with an uppercase 64-hex hash, and asks the node nothing otherwise", async () => {
    const node = fakeNode();
    const nano = adapter(node);
    for (const payload of [
      pay(SEND.hash.toLowerCase()),
      pay(SEND.hash.slice(1)),
      pay(42),
      pay(SEND.hash, { nonce: "x" }),
      { ...pay(SEND.hash), payload: { hash: SEND.hash } },
      { ...pay(SEND.hash), payload: undefined as unknown as Record<string, unknown> },
    ]) {
      expect(rejected(await nano.verify(payload, ctx())).code).toBe("invalid_payment");
    }
    expect(node.requests).toEqual([]);
  });
});

describe("node outages are exceptions, never verdicts", () => {
  const cases: Array<[string, Parameters<typeof fakeNode>[0]]> = [
    ["an HTTP 429", { [SEND.hash]: { status: 429, text: '{"error":"Too many requests"}' } }],
    ["an HTTP 500", { [SEND.hash]: { status: 500, text: "oops" } }],
    // A not-found verdict only counts when the node answered 200.
    ["an HTTP 502 whose body says not-found", { [SEND.hash]: { status: 502, text: '{"error":"Block not found"}' } }],
    ["a non-JSON 200", { [SEND.hash]: { status: 200, text: "<html>maintenance</html>" } }],
    ["JSON that is not a block_info reply", { [SEND.hash]: { status: "ok" } }],
    ["a node error other than not-found", { [SEND.hash]: { error: "Unsupported RPC Action" } }],
    ["a refused connection", { [SEND.hash]: new TypeError("fetch failed") }],
  ];

  for (const [name, answers] of cases) {
    it(`throws FacilitatorUnreachableError on ${name}`, async () => {
      await expect(adapter(fakeNode(answers)).verify(pay(SEND.hash), ctx())).rejects.toBeInstanceOf(
        FacilitatorUnreachableError,
      );
    });
  }

  it("does not call the node once the gate's budget is spent", async () => {
    const node = fakeNode();
    const controller = new AbortController();
    controller.abort();
    await expect(adapter(node).verify(pay(SEND.hash), ctx({ signal: controller.signal }))).rejects.toBeInstanceOf(
      FacilitatorUnreachableError,
    );
    expect(node.requests).toEqual([]);
  });
});

describe("facilitator contract suite (§11)", () => {
  it("the nano adapter passes every check", async () => {
    const checks = await runFacilitatorConformance(adapter(), {
      network: NANO_MAINNET,
      payTo: PAY_TO,
      asset: "xno",
    });
    const failed = checks.filter((check) => !check.ok);
    expect(failed, `\n${formatConformance(checks)}`).toEqual([]);
    // The suite checks a valid payment at the wall clock; a recorded block is
    // older than the age window by then, so that check is the live run's.
    expect(checks.some((check) => check.skipped)).toBe(true);
  });
});
