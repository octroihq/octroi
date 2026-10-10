import { OctroiConfigError, formatAtomic } from "@octroi/core";

/**
 * XNO amounts. 1 XNO is 10^30 raw, so an amount does not fit a float — 1e30
 * as a double is 19884624838656 raw away from 1 XNO — and every amount in
 * this package is a bigint of raw, parsed from a decimal string.
 */
export const XNO_DECIMALS = 30;

/** 1 XNO in raw. */
export const RAW_PER_XNO = 10n ** 30n;

const XNO_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * An XNO decimal string ("0.001") as raw. Throws {@link OctroiConfigError} on
 * anything else — a number, a negative, an exponent, or more than 30 decimal
 * places — rather than rounding: a price is something the merchant meant.
 *
 * Use it for `price`: core reads a *string* price as US dollars, so an XNO
 * price goes in as raw (`price: xnoToRaw("0.001")`).
 */
export function xnoToRaw(xno: string): bigint {
  if (typeof xno !== "string") {
    throw new OctroiConfigError(
      `XNO amount must be a decimal string, got ${typeof xno} — a float cannot hold 30 decimal places`,
    );
  }
  const match = XNO_PATTERN.exec(xno.trim());
  if (!match) {
    throw new OctroiConfigError(`could not parse XNO amount "${xno}"; expected a decimal like "0.001"`);
  }
  const fraction = match[2] ?? "";
  if (fraction.length > XNO_DECIMALS) {
    throw new OctroiConfigError(
      `XNO amount "${xno}" has ${fraction.length} decimal places; XNO carries ${XNO_DECIMALS}`,
    );
  }
  return BigInt((match[1] as string) + fraction.padEnd(XNO_DECIMALS, "0"));
}

/** Raw as an XNO decimal string with all 30 places, e.g. "0.001000…000". */
export function rawToXno(raw: bigint): string {
  return formatAtomic(raw, XNO_DECIMALS);
}
