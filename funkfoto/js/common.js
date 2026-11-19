// Shared helpers: checksums, scrambling, bit packing.
export function crc16(bytes, len = bytes.length) {
  let c = 0xffff;
  for (let i = 0; i < len; i++) {
    c ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c;
}

export function crc8(bytes, len = bytes.length) {
  let c = 0;
  for (let i = 0; i < len; i++) {
    c ^= bytes[i];
    for (let b = 0; b < 8; b++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

/** XOR with a fixed pseudo-random sequence (self-inverse). Avoids long runs / tonal patterns. */
export function scramble(bytes, seed = 0x5a) {
  const out = new Uint8Array(bytes.length);
  let s = seed | 1;
  for (let i = 0; i < bytes.length; i++) {
    s ^= s << 3;
    s ^= s >> 5;
    s ^= s << 1;
    s &= 0xff;
    if (!s) s = 0x1d;
    out[i] = bytes[i] ^ s;
  }
  return out;
}

export function bytesToBits(bytes) {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) for (let b = 0; b < 8; b++) bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
  return bits;
}

export function bitsToBytes(bits) {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | (bits[i * 8 + b] & 1);
    out[i] = v;
  }
  return out;
}

/** Collects packets of one transfer (identified by session id) until complete. */
export class Assembler {
  constructor() {
    this.sessions = new Map();
  }
  /** @returns the session state after adding the packet */
  add(p) {
    let s = this.sessions.get(p.session);
    if (!s || s.total !== p.total || s.length !== p.length) {
      s = { session: p.session, total: p.total, length: p.length, parts: new Array(p.total).fill(null), have: 0, firstSeen: Date.now() };
      this.sessions.set(p.session, s);
    }
    if (!s.parts[p.index]) {
      s.parts[p.index] = p.payload;
      s.have++;
    }
    s.lastSeen = Date.now();
    return s;
  }
  static join(s, payloadSize) {
    const out = new Uint8Array(s.length);
    s.parts.forEach((p, i) => {
      if (p) out.set(p.subarray(0, Math.min(payloadSize, s.length - i * payloadSize)), i * payloadSize);
    });
    return out;
  }
}
