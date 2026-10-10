/**
 * `@octroi/nano` — verify Nano (XNO) payments against a Nano node.
 *
 * Nano has no facilitator in the x402 sense: a payment is a send block the
 * payer publishes themselves, it confirms in about a second, and it carries no
 * fee for anyone to sponsor. So this adapter settles nothing and signs
 * nothing. The payer hands over the hash of a send block they already
 * published; `verify()` asks a node (`block_info`) whether that block is
 * confirmed, is a send, paid `payTo`, and how much it moved — and core's
 * replay store burns the hash.
 */
import {
  FacilitatorUnreachableError,
  registerFacilitator,
  type ChallengeRequest,
  type ChallengeScheme,
  type FacilitatorAdapter,
  type Network,
  type PaymentPayload,
  type VerifyContext,
  type VerifyResult,
} from "@octroi/core";
import { isNanoAddress, sameNanoAccount } from "./address.js";

export { isNanoAddress, nanoAddressFromPublicKey, nanoPublicKey, sameNanoAccount } from "./address.js";
export { RAW_PER_XNO, XNO_DECIMALS, rawToXno, xnoToRaw } from "./amount.js";

/** CAIP-2 id of Nano's live network. */
export const NANO_MAINNET: Network = "nano:mainnet";

/** The `asset` a gate is configured with, and what the challenge advertises. */
export const XNO_ASSET = "xno";
export const XNO_ASSET_CODE = "XNO";

/**
 * How old a block may be, by the node's own clock, and still pay for a
 * request. A Nano block never expires on its own, so without this a block
 * hash would become spendable again the moment the replay store forgot it.
 * Keep the gate's `replayTtlMs` above this window (the default 15 minutes is).
 */
export const DEFAULT_MAX_BLOCK_AGE_SECONDS = 600;

const BLOCK_HASH_RE = /^[0-9A-F]{64}$/;

export interface NanoFacilitatorOptions {
  /** A Nano node RPC endpoint, e.g. your own node or a public one. */
  rpcUrl: string;
  /** Headers for the RPC call — an API key, if your provider wants one. */
  headers?: Record<string, string>;
  /** Default 600. See {@link DEFAULT_MAX_BLOCK_AGE_SECONDS}. */
  maxBlockAgeSeconds?: number;
  /** Injected for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Per-RPC-call timeout. The gate applies its own outer budget too. */
  timeoutMs?: number;
  id?: string;
}

export function nanoFacilitator(options: NanoFacilitatorOptions): FacilitatorAdapter {
  if (!options || typeof options.rpcUrl !== "string" || !/^https?:\/\//.test(options.rpcUrl)) {
    throw new Error("nanoFacilitator: `rpcUrl` must be an http(s) URL of a Nano node RPC");
  }
  const rpcUrl = options.rpcUrl;
  const id = options.id ?? "nano";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxAgeSeconds = options.maxBlockAgeSeconds ?? DEFAULT_MAX_BLOCK_AGE_SECONDS;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new Error(`nanoFacilitator: maxBlockAgeSeconds must be a positive number, got ${maxAgeSeconds}`);
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("no fetch implementation available; pass `fetchImpl`");
  }

  const unreachable = (message: string, cause?: unknown) =>
    new FacilitatorUnreachableError(message, { facilitator: id, cause });

  async function blockInfo(hash: string, signal: AbortSignal): Promise<Record<string, unknown>> {
    if (signal.aborted) {
      throw unreachable(
        "nano block_info call abandoned before it started: the gate's verify budget was already spent",
        signal.reason,
      );
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      controller.abort(new Error(`nano block_info timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json", ...options.headers },
        signal: controller.signal,
        body: JSON.stringify({ action: "block_info", json_block: "true", hash }),
      });
      const text = await response.text();
      if (!response.ok) {
        // 403/429/5xx from a node or the proxy in front of it: nothing was
        // checked, so this is "could not ask", never "the payment is bad".
        throw unreachable(`nano node answered HTTP ${response.status}`);
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw unreachable(`nano node returned a non-JSON body (status ${response.status})`);
      }
      const record = asRecord(body);
      if (!record) throw unreachable(`nano node returned a non-object body (status ${response.status})`);
      return record;
    } catch (error) {
      if (error instanceof FacilitatorUnreachableError) throw error;
      throw unreachable(
        `nano block_info call failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  }

  return {
    id,
    networks: [NANO_MAINNET],

    buildChallenge(req: ChallengeRequest): ChallengeScheme {
      if (req.network !== NANO_MAINNET) {
        throw new Error(`nano adapter does not support network "${req.network}" (known: ${NANO_MAINNET})`);
      }
      if (req.asset.toLowerCase() !== XNO_ASSET) {
        throw new Error(`nano adapter only settles XNO, not "${req.asset}"; configure the gate with asset: "xno"`);
      }
      if (!isNanoAddress(req.payTo)) {
        // Refuse rather than advertise: a payer's wallet would send to a
        // mistyped address, and nothing sent there comes back.
        throw new Error(`payTo "${req.payTo}" is not a valid Nano address (bad prefix, length or checksum)`);
      }
      return {
        scheme: "exact",
        network: req.network,
        maxAmountRequired: req.amount.toString(),
        resource: req.resource,
        description: req.description,
        mimeType: req.mimeType,
        payTo: req.payTo,
        maxTimeoutSeconds: req.maxTimeoutSeconds,
        asset: XNO_ASSET_CODE,
        extra: null,
      };
    },

    async verify(payload: PaymentPayload, ctx: VerifyContext): Promise<VerifyResult> {
      const hash = readBlockHash(payload.payload);
      if (hash === undefined) {
        return {
          ok: false,
          code: "invalid_payment",
          message:
            'Nano payload must be exactly { "blockHash": "<64 uppercase hex>" }, the hash of a published send block.',
        };
      }

      const info = await blockInfo(hash, ctx.signal);

      if (info["error"] === "Block not found") {
        // The node answered, and it has no such block. Not an outage: a
        // payment that was never published is a bad payment.
        return { ok: false, code: "invalid_payment", message: "Nano node has no block with this hash.", raw: info };
      }
      if (info["error"] !== undefined) {
        // Any other error is the node (or something in front of it) failing
        // to answer — a rate limit, a disabled RPC — not a verdict on the block.
        throw unreachable(`nano node error: ${String(info["error"])}`);
      }

      const confirmed = info["confirmed"];
      const amount = info["amount"];
      const contents = asRecord(info["contents"]);
      if (typeof confirmed !== "string" || typeof amount !== "string" || !/^\d+$/.test(amount) || !contents) {
        // JSON, but not a block_info reply — a proxy's status page, a
        // rate-limit envelope. Nothing was checked, so it is an outage.
        throw unreachable("nano node reply is not a block_info answer (no confirmed/amount/contents)");
      }

      if (confirmed !== "true") {
        // Payloads are only burned after a pass, so the payer can retry this
        // one as soon as the network confirms it — usually within a second.
        return { ok: false, code: "invalid_payment", message: "Nano block is not confirmed yet; retry shortly.", raw: info };
      }

      const subtype = stringOr(info["subtype"]) ?? stringOr(contents["type"]);
      if (subtype !== "send") {
        return {
          ok: false,
          code: "invalid_payment",
          message: `Nano block is a ${subtype ?? "block of unknown type"}, not a send.`,
          raw: info,
        };
      }

      // The account PAID is the block's link (state block) or destination
      // (legacy send). `block_account` is the chain the block sits on: the payer.
      const paid = stringOr(contents["link_as_account"]) ?? stringOr(contents["destination"]);
      if (paid === undefined || !sameNanoAccount(paid, ctx.requirements.payTo)) {
        return { ok: false, code: "invalid_payment", message: "Nano block did not pay this route's payTo.", raw: info };
      }

      const seen = Number(stringOr(info["local_timestamp"]) ?? "0");
      if (!Number.isFinite(seen) || seen <= 0) {
        return {
          ok: false,
          code: "expired",
          message: "Nano node has no timestamp for this block, so it cannot be shown to be recent.",
          raw: info,
        };
      }
      if (seen * 1_000 < ctx.now - maxAgeSeconds * 1_000) {
        return {
          ok: false,
          code: "expired",
          message: `Nano block is older than ${maxAgeSeconds}s; pay with a new block.`,
          raw: info,
        };
      }

      const payer = stringOr(info["block_account"]) ?? stringOr(contents["account"]);
      return {
        ok: true,
        txRef: hash,
        // Core compares this against the route price and rejects an
        // underpayment as wrong_amount.
        settledAmount: BigInt(amount),
        payer: payer ?? "unknown",
        raw: info,
      };
    },
  };
}

/** Register under "nano" so `facilitator: "nano"` resolves (§3.1). */
export function registerNanoFacilitator(options: NanoFacilitatorOptions): FacilitatorAdapter {
  const adapter = nanoFacilitator(options);
  registerFacilitator(adapter);
  return adapter;
}

/**
 * The block hash, only in its one canonical spelling. Core's replay key is a
 * hash of the payload, so a payload with an extra key or a lowercase hash
 * would be a "new" payment for the same block; insisting on one exact shape
 * closes that, and core's `tx:` key catches anything else.
 */
function readBlockHash(payload: Record<string, unknown> | undefined): string | undefined {
  const record = asRecord(payload);
  if (!record) return undefined;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "blockHash") return undefined;
  const hash = record["blockHash"];
  return typeof hash === "string" && BLOCK_HASH_RE.test(hash) ? hash : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function stringOr(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
