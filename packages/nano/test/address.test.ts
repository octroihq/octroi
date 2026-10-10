import { blake2b as nobleBlake2b } from "@noble/hashes/blake2b";
import { describe, expect, it } from "vitest";
import { blake2b } from "../src/blake2b.js";
import {
  isNanoAddress,
  nanoAddressFromPublicKey,
  nanoPublicKey,
  sameNanoAccount,
} from "../src/index.js";
import fixtures from "./fixtures/block-info.json" with { type: "json" };

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex").toUpperCase();
const fromHex = (value: string) => new Uint8Array(Buffer.from(value, "hex"));

// The genesis account and its public key, as published in the node source.
const GENESIS = "nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3";
const GENESIS_KEY = "E89208DD038FBB269987689621D52292AE9C35941A7484756ECCED92A65093BA";
const BURN = "nano_1111111111111111111111111111111111111111111111111111hifc8npp";

describe("blake2b", () => {
  it("matches the RFC 7693 appendix A vector (BLAKE2b-512 of 'abc')", () => {
    expect(hex(blake2b(new TextEncoder().encode("abc"), 64)).toLowerCase()).toBe(
      "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1" +
        "7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
    );
  });

  it("matches @noble/hashes for every digest length and across block boundaries", () => {
    for (const size of [0, 1, 5, 32, 127, 128, 129, 256, 300]) {
      const input = Uint8Array.from({ length: size }, (_, i) => (i * 37 + size) & 0xff);
      for (let dkLen = 1; dkLen <= 64; dkLen += 1) {
        expect(hex(blake2b(input, dkLen))).toBe(hex(nobleBlake2b(input, { dkLen })));
      }
    }
  });

  it("is a different function from truncating the 64-byte digest", () => {
    const key = fromHex(GENESIS_KEY);
    expect(hex(blake2b(key, 5))).not.toBe(hex(blake2b(key, 64).slice(0, 5)));
  });

  it("refuses a digest length outside 1–64", () => {
    expect(() => blake2b(new Uint8Array(0), 0)).toThrow(RangeError);
    expect(() => blake2b(new Uint8Array(0), 65)).toThrow(RangeError);
  });
});

describe("Nano addresses", () => {
  it("decodes the genesis account to its published public key, and back", () => {
    expect(hex(nanoPublicKey(GENESIS) as Uint8Array)).toBe(GENESIS_KEY);
    expect(nanoAddressFromPublicKey(fromHex(GENESIS_KEY))).toBe(GENESIS);
  });

  it("decodes the burn address to the all-zero key", () => {
    expect(nanoPublicKey(BURN)).toEqual(new Uint8Array(32));
  });

  it("accepts every account a live node reported in the recorded fixtures", () => {
    const accounts = new Set<string>();
    for (const { reply } of Object.values(fixtures).filter((v) => typeof v === "object")) {
      const r = reply as Record<string, unknown> & { contents?: Record<string, unknown> };
      for (const value of [
        r["block_account"],
        r.contents?.["account"],
        r.contents?.["representative"],
        r.contents?.["link_as_account"],
        r.contents?.["destination"],
      ]) {
        if (typeof value === "string") accounts.add(value);
      }
    }
    expect(accounts.size).toBeGreaterThanOrEqual(6);
    for (const account of accounts) expect(isNanoAddress(account), account).toBe(true);
  });

  it("refuses a one-character typo anywhere in the address", () => {
    const body = GENESIS.slice(5);
    for (let i = 1; i < body.length; i += 1) {
      const swapped = body[i] === "1" ? "3" : "1";
      const typo = `nano_${body.slice(0, i)}${swapped}${body.slice(i + 1)}`;
      expect(isNanoAddress(typo), typo).toBe(false);
    }
  });

  it("refuses wrong prefixes, lengths, case and characters outside the alphabet", () => {
    expect(isNanoAddress(GENESIS.replace("nano_", "ban_"))).toBe(false);
    expect(isNanoAddress(GENESIS.replace("nano_", "nano-"))).toBe(false);
    expect(isNanoAddress(GENESIS.slice(0, -1))).toBe(false);
    expect(isNanoAddress(`${GENESIS}1`)).toBe(false);
    expect(isNanoAddress(GENESIS.toUpperCase())).toBe(false);
    // 0, 2, l and v are not in Nano's alphabet.
    for (const bad of ["0", "2", "l", "v"]) {
      expect(isNanoAddress(`${GENESIS.slice(0, 10)}${bad}${GENESIS.slice(11)}`)).toBe(false);
    }
    // 52 characters encode 260 bits, so the first must be 1 or 3.
    expect(isNanoAddress(`nano_5${GENESIS.slice(6)}`)).toBe(false);
    expect(isNanoAddress("")).toBe(false);
    expect(isNanoAddress(`0x${"1".repeat(40)}`)).toBe(false);
  });

  it("treats the xrb_ and nano_ spellings of one account as the same account", () => {
    const legacy = GENESIS.replace("nano_", "xrb_");
    expect(isNanoAddress(legacy)).toBe(true);
    expect(sameNanoAccount(legacy, GENESIS)).toBe(true);
    expect(sameNanoAccount(GENESIS, BURN)).toBe(false);
    expect(sameNanoAccount("not-an-address", "not-an-address")).toBe(false);
  });

  it("refuses to encode a key that is not 32 bytes", () => {
    expect(() => nanoAddressFromPublicKey(new Uint8Array(31))).toThrow(RangeError);
  });
});
