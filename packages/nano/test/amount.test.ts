import { OctroiConfigError } from "@octroi/core";
import { describe, expect, it } from "vitest";
import { RAW_PER_XNO, XNO_DECIMALS, rawToXno, xnoToRaw } from "../src/index.js";

describe("XNO amounts", () => {
  it("has 30 decimal places", () => {
    expect(XNO_DECIMALS).toBe(30);
    expect(RAW_PER_XNO).toBe(1_000_000_000_000_000_000_000_000_000_000n);
  });

  it("parses decimal strings to raw exactly", () => {
    expect(xnoToRaw("1")).toBe(RAW_PER_XNO);
    expect(xnoToRaw("50")).toBe(50n * RAW_PER_XNO);
    expect(xnoToRaw("0.001")).toBe(10n ** 27n);
    expect(xnoToRaw("0.000001")).toBe(10n ** 24n);
    expect(xnoToRaw(" 0.000000000000000000000000000001 ")).toBe(1n);
    expect(xnoToRaw("454.95047705943853369")).toBe(454_950_477_059_438_533_690_000_000_000_000n);
  });

  it("refuses more than 30 places, exponents, signs and numbers rather than rounding", () => {
    expect(() => xnoToRaw("0.0000000000000000000000000000001")).toThrow(OctroiConfigError);
    expect(() => xnoToRaw("1e-3")).toThrow(OctroiConfigError);
    expect(() => xnoToRaw("-1")).toThrow(OctroiConfigError);
    expect(() => xnoToRaw("$1")).toThrow(OctroiConfigError);
    expect(() => xnoToRaw("")).toThrow(OctroiConfigError);
    expect(() => xnoToRaw(0.001 as unknown as string)).toThrow(/float/);
  });

  it("is why amounts are never floats: 1e30 as a double is not 1 XNO", () => {
    expect(BigInt(1e30)).not.toBe(RAW_PER_XNO);
    expect(BigInt(1e30) - RAW_PER_XNO).toBe(19_884_624_838_656n);
  });

  it("formats raw back to XNO and round-trips", () => {
    expect(rawToXno(10n ** 27n)).toBe(`0.001${"0".repeat(27)}`);
    expect(rawToXno(1n)).toBe(`0.${"0".repeat(29)}1`);
    for (const xno of ["0.001", "50", "454.95047705943853369", "0.000000000000000000000000000001"]) {
      expect(xnoToRaw(rawToXno(xnoToRaw(xno)))).toBe(xnoToRaw(xno));
    }
  });
});
