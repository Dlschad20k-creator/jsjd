// Simulated acoustic channel: different sample rates, echoes, speaker/mic band limits,
// background noise, clock drift and arbitrary chunking — then decode with SoundRx.
import assert from 'node:assert/strict';
import { SoundRx, encodeFile, estimateSeconds, packetSeconds, SYMBOLS } from '../js/sound.js';
import { Assembler, crc16 } from '../js/common.js';

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

function channel(x, srIn, srOut, { snrDb = 15, echoes = [], drift = 0, lowcut = 300, gain = 0.3, dropouts: opts_dropouts = false }) {
  // resample with linear interpolation (srIn -> srOut, plus clock drift in ppm)
  const ratio = (srIn / srOut) * (1 + drift * 1e-6);
  const n = Math.floor(x.length / ratio);
  let y = new Float32Array(n + srOut); // + 1 s of trailing silence
  for (let i = 0; i < n; i++) {
    const t = i * ratio;
    const k = Math.floor(t);
    const f = t - k;
    y[i] = (x[k] ?? 0) * (1 - f) + (x[k + 1] ?? 0) * f;
  }
  // multipath
  const z = y.slice();
  for (const [ms, g] of echoes) {
    const d = Math.round((ms / 1000) * srOut);
    for (let i = d; i < y.length; i++) z[i] += g * y[i - d];
  }
  // tiny speaker: high-pass (no bass) + gentle low-pass
  const a = Math.exp((-2 * Math.PI * lowcut) / srOut);
  let hp = 0, prev = 0, lp = 0;
  const b = Math.exp((-2 * Math.PI * 7000) / srOut);
  let p = 0;
  for (let i = 0; i < z.length; i++) {
    hp = a * (hp + z[i] - prev);
    prev = z[i];
    lp = (1 - b) * hp + b * lp;
    z[i] = lp * gain;
    p += z[i] * z[i];
  }
  const sigPow = p / n;
  const noise = Math.sqrt(sigPow / Math.pow(10, snrDb / 10));
  // pink-ish noise: mix white + low-passed white
  let lpn = 0;
  for (let i = 0; i < z.length; i++) {
    lpn = 0.97 * lpn + 0.03 * gauss() * 6;
    z[i] += noise * (0.6 * gauss() + 0.8 * lpn);
  }
  if (opts_dropouts) for (let i = 0; i < z.length; i += Math.round(srOut * 3.1)) z.fill(0, i + srOut, i + srOut + Math.round(srOut * 0.25));
  return z;
}

function run(name, opts, bytesLen = 700, loops = 1) {
  const file = Uint8Array.from({ length: bytesLen }, (_, i) => (i * 37 + (i >> 3)) & 0xff);
  const tx = encodeFile(file, opts.srTx ?? 48000, 4242);
  let sig = tx.audio;
  if (loops > 1) {
    const l = new Float32Array(sig.length * loops);
    for (let k = 0; k < loops; k++) l.set(sig, k * sig.length);
    sig = l;
  }
  // leading silence/noise before transmission starts
  const lead = new Float32Array(Math.round(0.37 * (opts.srTx ?? 48000)));
  const full = new Float32Array(lead.length + sig.length);
  full.set(sig, lead.length);
  const srRx = opts.srRx ?? 48000;
  const rx = channel(full, opts.srTx ?? 48000, srRx, opts);
  const asm = new Assembler();
  let state = null;
  let corrected = 0;
  const r = new SoundRx(srRx, {
    onPacket: (p) => {
      corrected += p.corrected;
      state = asm.add(p);
    },
  });
  // feed in mic-like chunks of random size
  for (let i = 0; i < rx.length; ) {
    const n = 512 + Math.floor(rnd() * 4096);
    r.push(rx.subarray(i, i + n));
    i += n;
  }
  const got = state?.have ?? 0;
  const ok = state && state.have === state.total && crc16(Assembler.join(state, 62)) === crc16(file);
  console.log(`${name.padEnd(42)} packets ${got}/${tx.total} (syncs ${r.stats.syncs}, crc-fail ${r.stats.bad}, bytes fixed ${corrected}) ${ok ? 'OK' : 'INCOMPLETE'}`);
  return { ok, got, total: tx.total };
}

console.log(`packet ${packetSeconds().toFixed(2)} s, ${SYMBOLS} symbols, 1.8 KB photo ≈ ${estimateSeconds(1800).toFixed(0)} s`);
const results = [
  run('clean 48k -> 48k', { snrDb: 30 }),
  run('44.1k phone -> 48k phone', { srTx: 44100, srRx: 48000, snrDb: 20 }),
  run('48k -> 44.1k + 80 ppm drift', { srTx: 48000, srRx: 44100, snrDb: 20, drift: 80 }),
  run('room echoes (2/6/11 ms)', { snrDb: 18, echoes: [[2, 0.6], [6, 0.4], [11, 0.3]] }),
  run('noisy room (SNR 8 dB) + echoes', { snrDb: 8, echoes: [[3, 0.5], [9, 0.3]] }),
  run('very noisy (SNR 3 dB), 2 loops', { snrDb: 3, echoes: [[4, 0.4]] }, 700, 2),
  run('quiet speaker (gain 0.02)', { snrDb: 15, gain: 0.02 }),
  run('stress: SNR -4 dB, 2 loops', { snrDb: -4 }, 700, 2),
  run('stress: 25 ms echo (> guard), SNR 6', { snrDb: 6, echoes: [[25, 0.7], [40, 0.4]] }, 700, 2),
  run('stress: dropouts, 2 loops', { snrDb: 12, dropouts: true }, 700, 2),
];
assert.ok(results.slice(0, 5).every((r) => r.ok), 'all realistic channels must decode in one loop');
assert.ok(results[5].got >= results[5].total * 0.8, 'very noisy channel recovers most packets in 2 loops');
console.log('SOUND TESTS PASSED');
