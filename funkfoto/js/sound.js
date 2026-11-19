/**
 * Acoustic modem: sends bytes as sound from one phone's speaker to another phone's microphone.
 *
 * Each packet = linear chirp (sync) + gap + data symbols.
 * Data symbols use 16 parallel groups of 4 tones (MFSK): every group picks 1 of its 4 neighbouring
 * tones, so one symbol carries 16 x 2 = 32 bits. Neighbouring tones have similar loudness through
 * the speaker/mic, so picking the loudest of four is robust to the phones' frequency response.
 * Every symbol is followed by a guard (tone keeps playing, receiver ignores it) to absorb echoes.
 * Payload is protected by Reed-Solomon (corrects 10 wrong bytes / packet) + CRC16.
 * The sender repeats all packets in a loop until the receiver has every packet (no back channel).
 */
import { fft } from './fft.js';
import { rsDecode, rsEncode } from './rs.js';
import { bitsToBytes, bytesToBits, crc16, scramble } from './common.js';

export const SOUND = {
  f0: 1500, // first tone (Hz)
  df: 50, // tone spacing (Hz) = 2 / symbol window -> orthogonal
  groups: 16,
  tonesPerGroup: 4,
  ts: 0.04, // analysed part of a symbol (s)
  tg: 0.012, // guard (s)
  chirpLen: 0.12,
  chirpF0: 900,
  chirpF1: 5400,
  gap: 0.03,
  tail: 0.06,
  payload: 62, // file bytes per packet
  nsym: 20, // Reed-Solomon parity bytes
  header: 6,
};
const DATA_BYTES = SOUND.header + SOUND.payload + 2; // + crc16
const CODE_BYTES = DATA_BYTES + SOUND.nsym;
const DIBITS = CODE_BYTES * 4;
export const SYMBOLS = Math.ceil(DIBITS / SOUND.groups);
export const MAX_PACKETS = 255;

export function packetSeconds() {
  return SOUND.chirpLen + SOUND.gap + SYMBOLS * (SOUND.ts + SOUND.tg) + SOUND.tail;
}
export function packetCount(byteLength) {
  return Math.max(1, Math.ceil(byteLength / SOUND.payload));
}
export function estimateSeconds(byteLength) {
  return packetCount(byteLength) * packetSeconds();
}

function toneFreq(i) {
  return SOUND.f0 + i * SOUND.df;
}

function chirp(sr) {
  const n = Math.round(SOUND.chirpLen * sr);
  const out = new Float32Array(n);
  const T = SOUND.chirpLen;
  const k = (SOUND.chirpF1 - SOUND.chirpF0) / T;
  const taper = Math.round(0.006 * sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let w = 1;
    if (i < taper) w = 0.5 - 0.5 * Math.cos((Math.PI * i) / taper);
    else if (i > n - taper) w = 0.5 - 0.5 * Math.cos((Math.PI * (n - i)) / taper);
    out[i] = w * Math.sin(2 * Math.PI * (SOUND.chirpF0 * t + 0.5 * k * t * t));
  }
  return out;
}

/** Build the protected codeword bytes for one packet. */
export function buildPacketBytes(session, index, total, fileLength, payload) {
  const d = new Uint8Array(DATA_BYTES);
  d[0] = (session >> 8) & 0xff;
  d[1] = session & 0xff;
  d[2] = index;
  d[3] = total;
  d[4] = (fileLength >> 8) & 0xff;
  d[5] = fileLength & 0xff;
  d.set(payload.subarray(0, SOUND.payload), SOUND.header);
  const c = crc16(d, DATA_BYTES - 2);
  d[DATA_BYTES - 2] = c >> 8;
  d[DATA_BYTES - 1] = c & 0xff;
  return scramble(rsEncode(d, SOUND.nsym));
}

export function parsePacketBytes(code) {
  const dec = rsDecode(scramble(code), SOUND.nsym);
  if (!dec) return null;
  const d = dec.data;
  const c = crc16(d, DATA_BYTES - 2);
  if (d[DATA_BYTES - 2] !== c >> 8 || d[DATA_BYTES - 1] !== (c & 0xff)) return null;
  const total = d[3];
  const index = d[2];
  if (!total || index >= total) return null;
  return {
    session: (d[0] << 8) | d[1],
    index,
    total,
    length: (d[4] << 8) | d[5],
    payload: d.slice(SOUND.header, SOUND.header + SOUND.payload),
    corrected: dec.corrected,
  };
}

/** Synthesize the audio of one packet at sample rate sr. */
export function packetAudio(code, sr) {
  const bits = bytesToBits(code);
  const dibits = new Uint8Array(SYMBOLS * SOUND.groups);
  for (let i = 0; i < DIBITS; i++) dibits[i] = (bits[i * 2] << 1) | bits[i * 2 + 1];
  const ch = chirp(sr);
  const gapN = Math.round(SOUND.gap * sr);
  const symN = Math.round((SOUND.ts + SOUND.tg) * sr);
  const tailN = Math.round(SOUND.tail * sr);
  const dataStart = ch.length + gapN;
  const out = new Float32Array(dataStart + SYMBOLS * symN + tailN);
  for (let i = 0; i < ch.length; i++) out[i] = ch[i] * 0.85;
  const ramp = Math.round(0.003 * sr);
  const data = new Float32Array(SYMBOLS * symN + ramp);
  for (let s = 0; s < SYMBOLS; s++) {
    const s0 = s * symN;
    for (let g = 0; g < SOUND.groups; g++) {
      const tone = g * SOUND.tonesPerGroup + dibits[s * SOUND.groups + g];
      const w = (2 * Math.PI * toneFreq(tone)) / sr;
      const ph = (tone * 2.399963) % (2 * Math.PI); // golden-angle phases keep the peak level low
      for (let i = 0; i < symN + ramp; i++) {
        // fade in during the guard, fade out after the symbol (overlaps next guard only)
        let env = 1;
        if (i < ramp) env = 0.5 - 0.5 * Math.cos((Math.PI * i) / ramp);
        else if (i >= symN) env = 0.5 + 0.5 * Math.cos((Math.PI * (i - symN)) / ramp);
        data[s0 + i] += env * Math.sin(w * (s0 + i) + ph);
      }
    }
  }
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const k = 0.9 / (peak || 1);
  for (let i = 0; i < SYMBOLS * symN; i++) out[dataStart + i] = data[i] * k;
  return out;
}

/** Split a file into packets and render one full loop of audio. */
export function encodeFile(bytes, sr, session = (Math.random() * 65535) | 0) {
  const total = packetCount(bytes.length);
  if (total > MAX_PACKETS) throw new Error('Datei zu groß');
  const parts = [];
  for (let i = 0; i < total; i++) {
    const payload = new Uint8Array(SOUND.payload);
    payload.set(bytes.subarray(i * SOUND.payload, (i + 1) * SOUND.payload));
    parts.push(packetAudio(buildPacketBytes(session, i, total, bytes.length, payload), sr));
  }
  const len = parts.reduce((a, p) => a + p.length, 0);
  const audio = new Float32Array(len);
  const starts = [];
  let o = 0;
  for (const p of parts) {
    starts.push(o);
    audio.set(p, o);
    o += p.length;
  }
  return { audio, starts, total, session };
}

function goertzelPower(x, start, n, coeff, win) {
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s0 = x[start + i] * win[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

/**
 * Streaming receiver. Feed microphone samples with push(); packets arrive via onPacket.
 */
export class SoundRx {
  constructor(sr, { onPacket, onSync, threshold = 0.22 } = {}) {
    this.sr = sr;
    this.onPacket = onPacket ?? (() => {});
    this.onSync = onSync ?? (() => {});
    this.threshold = threshold;
    this.tpl = chirp(sr);
    this.L = this.tpl.length;
    let N = 1;
    while (N < this.L * 4) N <<= 1;
    this.N = N;
    this.H = N - this.L + 1;
    // template spectrum (conjugate for correlation)
    this.cre = new Float64Array(N);
    this.cim = new Float64Array(N);
    let e = 0;
    for (let i = 0; i < this.L; i++) {
      this.cre[i] = this.tpl[i];
      e += this.tpl[i] * this.tpl[i];
    }
    this.tplNorm = Math.sqrt(e);
    fft(this.cre, this.cim);
    this.re = new Float64Array(N);
    this.im = new Float64Array(N);
    this.buf = new Float32Array(sr * 6);
    this.len = 0;
    this.base = 0; // absolute index of buf[0]
    this.corrPos = 0; // absolute index of next lag to test
    this.cand = null;
    this.blockUntil = 0;
    this.pending = [];
    this.gapN = Math.round(SOUND.gap * sr);
    this.symN = Math.round((SOUND.ts + SOUND.tg) * sr);
    this.winN = Math.round(SOUND.ts * sr);
    this.pktN = this.L + this.gapN + SYMBOLS * this.symN;
    this.win = new Float32Array(this.winN);
    for (let i = 0; i < this.winN; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (this.winN - 1));
    const tones = SOUND.groups * SOUND.tonesPerGroup;
    this.coeff = new Float64Array(tones);
    for (let t = 0; t < tones; t++) this.coeff[t] = 2 * Math.cos((2 * Math.PI * toneFreq(t)) / sr);
    this.stats = { syncs: 0, good: 0, bad: 0, lastCorr: 0, lastQuality: 0 };
  }

  push(samples) {
    if (this.len + samples.length > this.buf.length) {
      // drop samples nobody needs any more
      const keepFrom = Math.min(this.corrPos, ...this.pending.map((p) => p.start)) - this.sr * 0.05;
      const drop = Math.max(0, Math.min(this.len, Math.floor(keepFrom - this.base)));
      if (drop > 0) {
        this.buf.copyWithin(0, drop, this.len);
        this.len -= drop;
        this.base += drop;
      }
      if (this.len + samples.length > this.buf.length) {
        const nb = new Float32Array(Math.max(this.buf.length * 2, this.len + samples.length));
        nb.set(this.buf.subarray(0, this.len));
        this.buf = nb;
      }
    }
    this.buf.set(samples, this.len);
    this.len += samples.length;
    this.correlate();
    this.demodPending();
  }

  correlate() {
    const { N, H, L } = this;
    while (this.corrPos + N <= this.base + this.len) {
      const off = this.corrPos - this.base;
      const x = this.buf;
      for (let i = 0; i < N; i++) {
        this.re[i] = x[off + i];
        this.im[i] = 0;
      }
      fft(this.re, this.im);
      for (let i = 0; i < N; i++) {
        const a = this.re[i];
        const b = this.im[i];
        const c = this.cre[i];
        const d = -this.cim[i];
        this.re[i] = a * c - b * d;
        this.im[i] = a * d + b * c;
      }
      fft(this.re, this.im, true);
      // sliding energy for normalisation
      let e = 0;
      for (let i = 0; i < L; i++) e += x[off + i] * x[off + i];
      for (let i = 0; i < H; i++) {
        const lag = this.corrPos + i;
        if (i > 0) {
          const a = x[off + i - 1];
          const b = x[off + i + L - 1];
          e += b * b - a * a;
        }
        if (lag < this.blockUntil) continue;
        const v = this.re[i] / (this.tplNorm * Math.sqrt(Math.max(e, 1e-12)));
        if (v > this.threshold && (!this.cand || v > this.cand.v)) this.cand = { lag, v };
        if (this.cand && lag > this.cand.lag + L / 2) this.accept();
      }
      this.corrPos += H;
    }
  }

  accept() {
    const c = this.cand;
    this.cand = null;
    this.stats.syncs++;
    this.stats.lastCorr = c.v;
    this.blockUntil = c.lag + this.pktN - this.L / 2;
    this.pending.push({ start: c.lag, corr: c.v });
    this.onSync(c.v);
  }

  demodPending() {
    const end = this.base + this.len;
    const slack = Math.round(0.004 * this.sr);
    while (this.pending.length && this.pending[0].start + this.pktN + slack + this.winN <= end) {
      const p = this.pending.shift();
      let best = null;
      for (const shift of [0, -slack, slack, -2 * slack, 2 * slack]) {
        const r = this.demod(p.start + shift);
        if (r.packet) {
          best = r;
          break;
        }
        if (!best || r.quality > best.quality) best = r;
      }
      this.stats.lastQuality = best.quality;
      if (best.packet) {
        this.stats.good++;
        this.onPacket(best.packet, { corr: p.corr, quality: best.quality });
      } else this.stats.bad++;
    }
  }

  demod(start) {
    const groups = SOUND.groups;
    const tpg = SOUND.tonesPerGroup;
    const dibits = new Uint8Array(SYMBOLS * groups);
    const pw = new Float64Array(tpg);
    let qSum = 0;
    const guardSkip = Math.round(SOUND.tg * this.sr * 0.7);
    for (let s = 0; s < SYMBOLS; s++) {
      const w0 = start + this.L + this.gapN + s * this.symN + guardSkip - this.base;
      if (w0 < 0 || w0 + this.winN > this.len) return { packet: null, quality: 0 };
      for (let g = 0; g < groups; g++) {
        let bi = 0;
        for (let m = 0; m < tpg; m++) {
          pw[m] = goertzelPower(this.buf, w0, this.winN, this.coeff[g * tpg + m], this.win);
          if (pw[m] > pw[bi]) bi = m;
        }
        let second = 0;
        for (let m = 0; m < tpg; m++) if (m !== bi) second = Math.max(second, pw[m]);
        qSum += Math.min(20, pw[bi] / (second + 1e-12));
        dibits[s * groups + g] = bi;
      }
    }
    const bits = new Uint8Array(CODE_BYTES * 8);
    for (let i = 0; i < DIBITS; i++) {
      bits[i * 2] = dibits[i] >> 1;
      bits[i * 2 + 1] = dibits[i] & 1;
    }
    const packet = parsePacketBytes(bitsToBytes(bits));
    return { packet, quality: qSum / (SYMBOLS * groups) };
  }
}
