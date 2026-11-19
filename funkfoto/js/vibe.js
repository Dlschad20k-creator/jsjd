/**
 * Vibration modem: the sending phone's vibration motor is switched on/off (OOK, like Morse code),
 * the receiving phone lies next to/under it and measures the buzz with its microphone or accelerometer.
 *
 * Packet: [preamble ON 700 ms][OFF 450 ms][training 10101010][sync 8 bits][data bits]
 * The receiver learns the on/off levels from the preamble and the bit length from the training
 * bits, so the sender's speed setting is detected automatically. Data: Reed-Solomon + CRC8.
 * Motors need time to spin up/down, so bits are long (60-140 ms) -> about 7-15 bit/s.
 */
import { rsDecode, rsEncode } from './rs.js';
import { bitsToBytes, bytesToBits, crc8, scramble } from './common.js';

export const VIBE = {
  preOn: 700,
  preOff: 450,
  train: [1, 0, 1, 0, 1, 0, 1, 0],
  sync: [1, 1, 0, 0, 1, 0, 1, 1],
  header: 4,
  payload: 16,
  nsym: 8,
  pause: 900, // between packets
};
const DATA_BYTES = VIBE.header + VIBE.payload + 1;
const CODE_BYTES = DATA_BYTES + VIBE.nsym;
export const VIBE_DATA_BITS = CODE_BYTES * 8;
export const SPEEDS = { fast: 65, normal: 90, safe: 130, sensor: 200 };

export function vibePacketMs(bitMs) {
  return VIBE.preOn + VIBE.preOff + (VIBE.train.length + VIBE.sync.length + VIBE_DATA_BITS) * bitMs + VIBE.pause;
}
export function vibePacketCount(len) {
  return Math.max(1, Math.ceil(len / VIBE.payload));
}

export function buildVibeCode(session, index, total, length, payload) {
  const d = new Uint8Array(DATA_BYTES);
  d[0] = session & 0xff;
  d[1] = index;
  d[2] = total;
  d[3] = length;
  d.set(payload.subarray(0, VIBE.payload), VIBE.header);
  d[DATA_BYTES - 1] = crc8(d, DATA_BYTES - 1);
  return scramble(rsEncode(d, VIBE.nsym), 0x3b);
}

export function parseVibeCode(code) {
  const dec = rsDecode(scramble(code, 0x3b), VIBE.nsym);
  if (!dec) return null;
  const d = dec.data;
  if (crc8(d, DATA_BYTES - 1) !== d[DATA_BYTES - 1]) return null;
  if (!d[2] || d[1] >= d[2]) return null;
  return { session: d[0], index: d[1], total: d[2], length: d[3], payload: d.slice(VIBE.header, VIBE.header + VIBE.payload), corrected: dec.corrected };
}

/** Timeline of [on(bool), ms] segments for all packets of a file. */
export function vibeTimeline(bytes, bitMs, session = (Math.random() * 255) | 0) {
  if (bytes.length > 255) throw new Error('Bild zu groß für Vibration');
  const total = vibePacketCount(bytes.length);
  const packets = [];
  for (let i = 0; i < total; i++) {
    const payload = new Uint8Array(VIBE.payload);
    payload.set(bytes.subarray(i * VIBE.payload, (i + 1) * VIBE.payload));
    const bits = [...VIBE.train, ...VIBE.sync, ...bytesToBits(buildVibeCode(session, i, total, bytes.length, payload))];
    const seg = [
      [true, VIBE.preOn],
      [false, VIBE.preOff],
    ];
    for (const b of bits) {
      const on = b === 1;
      const last = seg[seg.length - 1];
      if (last[0] === on) last[1] += bitMs;
      else seg.push([on, bitMs]);
    }
    if (seg[seg.length - 1][0]) seg.push([false, VIBE.pause]);
    else seg[seg.length - 1][1] += VIBE.pause;
    packets.push(seg);
  }
  return { packets, total, session };
}

/**
 * Split segments into navigator.vibrate() calls: each call gets an array [on, off, on, ...]
 * of at most `maxLen` entries and starts at `at` ms after the packet start.
 */
export function vibrateCalls(segments, maxLen = 64) {
  const calls = [];
  let t = 0;
  let cur = null;
  for (const [on, ms] of segments) {
    if (!cur || cur.pattern.length >= maxLen) {
      if (cur && on === false) {
        // never start a call with "off": fold it into the previous call
        cur.pattern.push(ms);
        t += ms;
        continue;
      }
      cur = { at: t, pattern: on ? [] : [0] };
      calls.push(cur);
    }
    cur.pattern.push(ms);
    t += ms;
  }
  return calls;
}

/**
 * Streaming receiver for an intensity signal (mic buzz energy or accelerometer magnitude).
 * push(timeMs, value) with any sample rate; internally resampled to a 5 ms grid and smoothed.
 *
 * 1. idle      – learn the noise floor; a preamble is "loud for >= 80 % of 400 ms"
 * 2. preamble  – measure the ON level, wait for the preamble to end
 * 3. search    – matched search over start time and bit length for the known 16 training+sync
 *                bits (robust: uses all 16 bits, not single edges)
 * 4. data      – sample every bit at its centre; re-time every 8 bits by maximising eye opening
 */
export class VibeRx {
  constructor({ onPacket, onState, smoothMs = 20 } = {}) {
    this.onPacket = onPacket ?? (() => {});
    this.onState = onState ?? (() => {});
    this.dt = 5;
    this.alpha = 1 - Math.exp(-this.dt / smoothMs);
    this.cap = 90000 / this.dt; // ring buffer: last 90 s
    this.env = new Float32Array(this.cap);
    this.cum = new Float64Array(this.cap); // prefix sums of env (ring) for O(1) window means
    this.n = 0;
    this.t0 = null;
    this.lastV = 0;
    this.e = 0;
    this.sum = 0;
    this.floor = null;
    this.state = 'idle';
    this.stats = { packets: 0, failed: 0 };
    this.view = { thr: 0, on: 0, floor: 0, bitMs: 0 };
    this.W = Math.round(400 / this.dt);
    this.loudHist = new Uint8Array(this.W);
    this.loudCount = 0;
    this.failedSoft = []; // soft bits of packets that failed, for combining with later repeats
  }

  at(i) {
    return this.env[i % this.cap];
  }
  time(i) {
    return this.t0 + i * this.dt;
  }
  idx(t) {
    return Math.round((t - this.t0) / this.dt);
  }
  /** mean envelope over [t - half, t + half] */
  mean(t, half) {
    let a = this.idx(t - half);
    let b = this.idx(t + half);
    a = Math.max(a, this.n - this.cap + 1, 1);
    b = Math.min(b, this.n - 1);
    if (b < a) return 0;
    return (this.cum[b % this.cap] - this.cum[(a - 1) % this.cap]) / (b - a + 1);
  }

  push(tMs, v) {
    if (this.t0 === null) {
      this.t0 = tMs;
      this.e = v;
    }
    while (this.time(this.n) <= tMs) {
      this.e += this.alpha * (this.lastV - this.e);
      this.sum += this.e;
      this.env[this.n % this.cap] = this.e;
      this.cum[this.n % this.cap] = this.sum;
      this.step(this.n);
      this.n++;
    }
    this.lastV = v;
  }

  setState(s) {
    this.state = s;
    this.onState(s, this.view);
  }

  reset() {
    this.loudHist.fill(0);
    this.loudCount = 0;
    this.pre = null;
    this.frame = null;
    this.setState('idle');
  }

  fail() {
    this.stats.failed++;
    this.reset();
  }

  step(i) {
    const e = this.at(i);
    if (this.floor === null) {
      if (i >= 60) {
        const arr = [];
        for (let k = 0; k < 60; k++) arr.push(this.at(k));
        arr.sort((a, b) => a - b);
        this.floor = Math.max(arr[30], 1e-9);
      }
      return;
    }
    this.view.floor = this.floor;
    const now = this.time(i);
    if (this.state === 'idle') {
      if (e < this.floor * 1.6) this.floor += 0.004 * (e - this.floor);
      const loud = e > this.floor * 2.6 ? 1 : 0;
      this.loudCount += loud - this.loudHist[i % this.W];
      this.loudHist[i % this.W] = loud;
      if (this.loudCount >= this.W * 0.8) {
        this.pre = { start: now - 400 };
        this.setState('preamble');
      }
      return;
    }
    if (this.state === 'preamble') {
      const p = this.pre;
      if (now - p.start > 2600) return this.fail(); // too long to be our preamble (e.g. a phone call buzz)
      if (now - p.start < 250) return;
      if (p.on === undefined || now - p.start < 450) p.on = this.mean(now - 125, 125);
      const mid = (p.on + this.floor) / 2;
      if (this.mean(now - 25, 25) < mid) {
        p.end = now - 25; // preamble's falling edge (incl. motor spin-down)
        this.setState('search');
      }
      return;
    }
    if (this.state === 'search') {
      const p = this.pre;
      // wait until 16 bits at the slowest speed have arrived
      if (now < p.end + VIBE.preOff + 16 * 235 + 150) return;
      p.off = this.mean(p.end + VIBE.preOff - 140, 90);
      if (!(p.on > p.off * 1.6)) return this.fail();
      const thr = (p.on + p.off) / 2;
      const known = [...VIBE.train, ...VIBE.sync];
      let best = { score: -Infinity };
      for (let T = 40; T <= 230; T += 1) {
        for (let s = p.end + VIBE.preOff - 140; s <= p.end + VIBE.preOff + 160; s += 4) {
          let sc = 0;
          for (let k = 0; k < known.length; k++) {
            const v = this.mean(s + k * T + T / 2, T * 0.3) - thr;
            sc += known[k] ? v : -v;
          }
          if (sc > best.score) best = { score: sc, T, s };
        }
      }
      // the sender only uses the exact SPEEDS: snap to one, so bit timing cannot accumulate error
      const snap = Object.values(SPEEDS).find((v) => Math.abs(best.T - v) / v < 0.08);
      const Ts = snap ? [snap] : [best.T - 1, best.T - 0.5, best.T, best.T + 0.5, best.T + 1];
      if (snap) best.score = -Infinity;
      for (const T of Ts)
        for (let s = best.s - 8; s <= best.s + 8; s += 1) {
          let sc = 0;
          for (let k = 0; k < known.length; k++) {
            const v = this.mean(s + k * T + T / 2, T * 0.3) - thr;
            sc += known[k] ? v : -v;
          }
          if (sc > best.score) best = { score: sc, T, s };
        }
      const norm = best.score / (known.length * (p.on - p.off) / 2);
      // verify the sync word with the found timing
      let syncErr = 0;
      for (let k = 0; k < VIBE.sync.length; k++) {
        const j = VIBE.train.length + k;
        const b = this.mean(best.s + j * best.T + best.T / 2, best.T * 0.3) > thr ? 1 : 0;
        if (b !== VIBE.sync[k]) syncErr++;
      }
      if (norm < 0.25 || syncErr > 1) return this.fail();
      this.thr = thr;
      this.view.thr = thr;
      this.view.on = p.on;
      this.view.bitMs = best.T;
      this.frame = { s: best.s, T: best.T, first: known.length, nbits: known.length + VIBE_DATA_BITS };
      this.setState('data');
      return;
    }
    if (this.state === 'data') {
      const f = this.frame;
      if (now > f.s + f.nbits * f.T + f.T * 0.8) this.decode();
    }
  }

  decode() {
    const f = this.frame;
    const soft = new Float32Array(VIBE_DATA_BITS); // > 0 means "1", scaled to the eye height
    const span = (this.view.on - this.pre.off) / 2 || 1;
    let phase = 0;
    for (let j = f.first; j < f.nbits; j++) {
      if ((j - f.first) % 8 === 0) {
        // re-time (absorbs the sender's timer jitter between vibrate() calls): offset that maximises
        // the eye opening of the next 16 bits; accept only clear improvements so noise is not chased
        const eye = (d) => {
          let sc = 0;
          for (let k = j; k < Math.min(j + 16, f.nbits); k++) sc += Math.abs(this.mean(f.s + k * f.T + f.T / 2 + phase + d, f.T * 0.22) - this.thr);
          return sc;
        };
        const base = eye(0);
        let bestD = 0;
        let bestSc = base;
        for (let d = -0.16 * f.T; d <= 0.16 * f.T; d += 2) {
          const sc = eye(d);
          if (sc > bestSc) {
            bestSc = sc;
            bestD = d;
          }
        }
        if (bestSc > base * 1.06) phase += 0.5 * bestD;
      }
      const c = f.s + j * f.T + f.T / 2 + phase;
      soft[j - f.first] = Math.max(-2, Math.min(2, (this.mean(c, f.T * 0.28) - this.thr) / span));
    }
    const p = this.trySoft(soft);
    if (p) {
      this.stats.packets++;
      this.onPacket(p.packet, { bitMs: f.T, combined: p.combined });
      this.reset();
    } else {
      this.failedSoft.push(soft);
      if (this.failedSoft.length > 14) this.failedSoft.shift();
      this.fail();
    }
  }

  /** Decode, else combine with earlier failed receptions of (hopefully) the same packet. */
  trySoft(soft) {
    const dec = (v) => {
      const bits = new Uint8Array(v.length);
      for (let i = 0; i < v.length; i++) bits[i] = v[i] > 0 ? 1 : 0;
      this.lastBits = bits;
      return parseVibeCode(bitsToBytes(bits));
    };
    let p = dec(soft);
    if (p) return { packet: p, combined: 1 };
    const F = this.failedSoft;
    const sum = (...vs) => {
      const o = new Float32Array(soft.length);
      for (const v of vs) for (let i = 0; i < o.length; i++) o[i] += v[i];
      return o;
    };
    for (let a = F.length - 1; a >= 0; a--) {
      p = dec(sum(soft, F[a]));
      if (p) {
        F.splice(a, 1);
        return { packet: p, combined: 2 };
      }
    }
    for (let a = F.length - 1; a >= 0; a--)
      for (let b = a - 1; b >= 0; b--) {
        p = dec(sum(soft, F[a], F[b]));
        if (p) {
          F.splice(a, 1);
          F.splice(b, 1);
          return { packet: p, combined: 3 };
        }
      }
    return null;
  }
}
