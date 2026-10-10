/**
 * Unkeyed BLAKE2b (RFC 7693) with a caller-chosen digest length.
 *
 * Nano's account checksum is a 5-byte BLAKE2b digest of the public key. That
 * is a different function from a truncated BLAKE2b-512: the output length is a
 * parameter of the hash and changes every byte of it. WebCrypto has no BLAKE2
 * at all and `node:crypto` only offers the fixed 64-byte variant, so — to keep
 * the package dependency-free and runnable on Workers — it lives here. It is
 * only ever fed 32-byte public keys, so it is written for clarity, not speed.
 */

const IV = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n,
] as const;

const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
] as const;

const MASK = 0xffffffffffffffffn;

function rotr(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK;
}

function compress(h: bigint[], block: Uint8Array, counter: bigint, last: boolean): void {
  const m: bigint[] = [];
  for (let i = 0; i < 16; i += 1) {
    let word = 0n;
    for (let b = 7; b >= 0; b -= 1) word = (word << 8n) | BigInt(block[i * 8 + b] ?? 0);
    m.push(word);
  }

  const v = [...h, ...IV];
  v[12] = (v[12] as bigint) ^ (counter & MASK);
  v[13] = (v[13] as bigint) ^ (counter >> 64n);
  if (last) v[14] = (v[14] as bigint) ^ MASK;

  const g = (a: number, b: number, c: number, d: number, x: bigint, y: bigint) => {
    v[a] = ((v[a] as bigint) + (v[b] as bigint) + x) & MASK;
    v[d] = rotr((v[d] as bigint) ^ (v[a] as bigint), 32n);
    v[c] = ((v[c] as bigint) + (v[d] as bigint)) & MASK;
    v[b] = rotr((v[b] as bigint) ^ (v[c] as bigint), 24n);
    v[a] = ((v[a] as bigint) + (v[b] as bigint) + y) & MASK;
    v[d] = rotr((v[d] as bigint) ^ (v[a] as bigint), 16n);
    v[c] = ((v[c] as bigint) + (v[d] as bigint)) & MASK;
    v[b] = rotr((v[b] as bigint) ^ (v[c] as bigint), 63n);
  };

  for (let round = 0; round < 12; round += 1) {
    const s = SIGMA[round % 10] as readonly number[];
    const w = (i: number) => m[s[i] as number] as bigint;
    g(0, 4, 8, 12, w(0), w(1));
    g(1, 5, 9, 13, w(2), w(3));
    g(2, 6, 10, 14, w(4), w(5));
    g(3, 7, 11, 15, w(6), w(7));
    g(0, 5, 10, 15, w(8), w(9));
    g(1, 6, 11, 12, w(10), w(11));
    g(2, 7, 8, 13, w(12), w(13));
    g(3, 4, 9, 14, w(14), w(15));
  }

  for (let i = 0; i < 8; i += 1) {
    h[i] = (h[i] as bigint) ^ (v[i] as bigint) ^ (v[i + 8] as bigint);
  }
}

/** BLAKE2b of `input` with an `outLength`-byte digest (1–64). */
export function blake2b(input: Uint8Array, outLength: number): Uint8Array {
  if (!Number.isInteger(outLength) || outLength < 1 || outLength > 64) {
    throw new RangeError(`blake2b digest length must be 1–64 bytes, got ${outLength}`);
  }

  const h: bigint[] = [...IV];
  // Parameter block, first word: digest length, key length 0, fanout 1, depth 1.
  h[0] = (h[0] as bigint) ^ BigInt(0x01010000 | outLength);

  let offset = 0;
  // Every full block except the last is compressed as non-final; the last one
  // (possibly partial, possibly empty for empty input) carries the final flag.
  while (input.length - offset > 128) {
    compress(h, input.subarray(offset, offset + 128), BigInt(offset + 128), false);
    offset += 128;
  }
  const tail = new Uint8Array(128);
  tail.set(input.subarray(offset));
  compress(h, tail, BigInt(input.length), true);

  const out = new Uint8Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    out[i] = Number(((h[i >> 3] as bigint) >> BigInt(8 * (i & 7))) & 0xffn);
  }
  return out;
}
