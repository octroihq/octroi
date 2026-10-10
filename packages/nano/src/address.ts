import { blake2b } from "./blake2b.js";

/**
 * Nano account addresses.
 *
 * `nano_` + 60 characters of Nano's base32 alphabet: 52 encode the 32-byte
 * Ed25519 public key (left-padded with four zero bits to 260), and 8 encode a
 * 5-byte BLAKE2b digest of that key, byte-reversed. The legacy `xrb_` prefix
 * spells the same account with the same 60 characters.
 *
 * A one-character typo in `payTo` is the expensive mistake here — a payer's
 * wallet would happily send to it and XNO does not come back — so addresses
 * are checked by checksum, not by shape.
 */

const ALPHABET = "13456789abcdefghijkmnopqrstuwxyz";
const ADDRESS_RE = /^(nano|xrb)_([13][13456789abcdefghijkmnopqrstuwxyz]{59})$/;

function decodeBase32(chars: string): bigint {
  let value = 0n;
  for (const char of chars) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`"${char}" is not in the Nano alphabet`);
    value = (value << 5n) | BigInt(index);
  }
  return value;
}

function encodeBase32(value: bigint, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out = (ALPHABET[Number(value & 31n)] as string) + out;
    value >>= 5n;
  }
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i -= 1) {
    out[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return out;
}

function checksum(publicKey: Uint8Array): bigint {
  return bytesToBigInt(blake2b(publicKey, 5).reverse());
}

/**
 * The 32-byte public key an address names, or `undefined` when the string is
 * not a Nano address: wrong prefix, wrong length, a character outside the
 * alphabet, or a checksum that does not match.
 */
export function nanoPublicKey(address: string): Uint8Array | undefined {
  if (typeof address !== "string") return undefined;
  const match = ADDRESS_RE.exec(address);
  if (!match) return undefined;
  const body = match[2] as string;
  const key = bigIntToBytes(decodeBase32(body.slice(0, 52)), 32);
  if (decodeBase32(body.slice(52)) !== checksum(key)) return undefined;
  return key;
}

/** True only for a well-formed `nano_`/`xrb_` address whose checksum matches. */
export function isNanoAddress(address: string): boolean {
  return nanoPublicKey(address) !== undefined;
}

/** The `nano_` address for a 32-byte public key. */
export function nanoAddressFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new RangeError(`a Nano public key is 32 bytes, got ${publicKey.length}`);
  }
  return `nano_${encodeBase32(bytesToBigInt(publicKey), 52)}${encodeBase32(checksum(publicKey), 8)}`;
}

/**
 * Whether two strings name the same account. Compared by public key, so the
 * `nano_` and `xrb_` spellings of one account are equal — a node always
 * answers in `nano_`, a merchant may have configured either — while anything
 * that is not a valid address equals nothing, itself included.
 */
export function sameNanoAccount(a: string, b: string): boolean {
  const left = nanoPublicKey(a);
  const right = nanoPublicKey(b);
  if (!left || !right) return false;
  return left.every((byte, i) => byte === right[i]);
}
