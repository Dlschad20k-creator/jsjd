// Simulated vibration link: motor spin-up/down lag, buzz picked up by the receiving phone's
// accelerometer (60 Hz, aliased, jittery) or microphone energy (≈94 frames/s), with noise.
import assert from 'node:assert/strict';
import { VibeRx, vibeTimeline, vibrateCalls, vibePacketMs, SPEEDS, buildVibeCode, VIBE } from '../js/vibe.js';
import { bytesToBits } from '../js/common.js';
import { Assembler } from '../js/common.js';

let seed = 99;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

function simulate(name, { bitMs, sensor, tauOn = 25, tauOff = 45, noise = 0.15, jitter = 0, callJitter = 0, timerDrift = 0, loops = 1 }) {
  const file = Uint8Array.from({ length: 74 }, (_, i) => (i * 29 + 7) & 0xff); // 24x24 1-bit image
  const tl = vibeTimeline(file, bitMs, 17);
  // sender schedules navigator.vibrate() calls with setTimeout jitter
  const cmds = []; // [t, on]
  let t = 1500;
  for (let l = 0; l < loops; l++)
    for (const seg of tl.packets) {
      const calls = vibrateCalls(seg);
      let segEnd = t;
      for (const c of calls) {
        let tt = t + c.at + (rnd() - 0.5) * 2 * callJitter;
        // a new navigator.vibrate() call cancels whatever pattern is still running
        for (let q = cmds.length - 1; q >= 0 && cmds[q][0] >= tt; q--) cmds.splice(q, 1);
        c.pattern.forEach((ms, k) => {
          cmds.push([tt, k % 2 === 0]);
          tt += ms * (1 + timerDrift * 1e-6);
        });
        cmds.push([tt, false]);
        segEnd = Math.max(segEnd, tt);
      }
      t = segEnd;
    }
  cmds.sort((a, b) => a[0] - b[0]);
  const end = t + 2000;
  const asm = new Assembler();
  let state = null;
  const truths = [];
  for (let i = 0; i < tl.total; i++) {
    const pl = new Uint8Array(VIBE.payload);
    pl.set(file.subarray(i * VIBE.payload, (i + 1) * VIBE.payload));
    truths.push(bytesToBits(buildVibeCode(17, i, tl.total, file.length, pl)));
  }
  const errs = [];
  const rx = new VibeRx({
    onPacket: (p) => (state = asm.add(p)),
    smoothMs: sensor === 'accel' ? 45 : 20,
    onState: (st) => {
      if (st === 'idle' && rx.lastBits && rx.lastBits !== seenBits) {
        seenBits = rx.lastBits;
        const cnt = truths.map((tb) => tb.reduce((a, b, i) => a + (b !== rx.lastBits[i] ? 1 : 0), 0));
        const best = Math.min(...cnt);
        errs.push(best);
        if (process.env.DEBUG === '2' && best > 15) {
          const tb = truths[cnt.indexOf(best)];
          const quart = [0, 0, 0, 0];
          for (let i = 0; i < tb.length; i++) if (tb[i] !== rx.lastBits[i]) quart[Math.floor((i * 4) / tb.length)]++;
          console.log('   errors per quarter', quart.join('/'), 'T', rx.view.bitMs);
        }
      }
    },
  });
  let seenBits = null;
  let amp = 0;
  let ci = 0;
  let on = false;
  const dt = 1; // 1 ms physics
  const rate = sensor === 'accel' ? 60 : 93.75;
  let nextSample = 0;
  let acc = 0, accN = 0;
  let motorHz = 172, phase = 0, lastMs = 0, lastA = 0, base = 0;
  for (let ms = 0; ms < end; ms += dt) {
    while (ci < cmds.length && cmds[ci][0] <= ms) on = cmds[ci++][1];
    amp += ((on ? 1 : 0) - amp) * (dt / (on ? tauOn : tauOff));
    if (sensor === 'mic') {
      // buzz energy accumulated over the frame
      acc += amp * amp + noise * noise * Math.abs(gauss());
      accN++;
    }
    if (ms >= nextSample) {
      if (sensor === 'accel') {
        // ~170 Hz buzz (frequency wanders with load/voltage) sampled at 60 Hz -> aliased.
        // The app feeds the receiver |a(k) - a(k-1)| (high-pass), like this:
        motorHz += (rnd() - 0.5) * 2 - (motorHz - 172) * 0.02;
        phase += 2 * Math.PI * motorHz * ((ms - lastMs) / 1000);
        lastMs = ms;
        const a = amp * Math.sin(phase) + noise * gauss();
        base += (a - base) * 0.04; // the app subtracts a slow moving average (posture / gravity)
        rx.push(ms, Math.abs(a - base));
        lastA = a;
      } else {
        rx.push(ms, acc / accN);
        acc = 0;
        accN = 0;
      }
      nextSample = ms + 1000 / rate + (rnd() - 0.5) * 2 * jitter;
    }
  }
  const ok = state && state.have === state.total;
  console.log(`${name.padEnd(46)} packets ${state?.have ?? 0}/${tl.total} decoded ${rx.stats.packets}, failed ${rx.stats.failed} ${ok ? 'OK' : 'INCOMPLETE'}${process.env.DEBUG ? ' biterrs ' + errs.join(',') : ''}`);
  return ok;
}

const sec = (ms) => (ms / 1000).toFixed(0);
console.log('(accelerometer at normal/safe speed and weak contact: informational, not asserted)');
console.log(`24x24 image = 74 bytes = 5 packets: fast ${sec(5 * vibePacketMs(SPEEDS.fast))} s, normal ${sec(5 * vibePacketMs(SPEEDS.normal))} s, safe ${sec(5 * vibePacketMs(SPEEDS.safe))} s`);
const res = [
  simulate('mic, normal speed', { bitMs: SPEEDS.normal, sensor: 'mic' }),
  simulate('mic, fast speed, LRA motor', { bitMs: SPEEDS.fast, sensor: 'mic', tauOn: 12, tauOff: 18 }),
  simulate('mic, safe speed, slow ERM motor, noisy', { bitMs: SPEEDS.safe, sensor: 'mic', tauOn: 40, tauOff: 70, noise: 0.35 }),
  simulate('accelerometer 60 Hz jittery, normal, 3 loops', { bitMs: SPEEDS.normal, sensor: 'accel', jitter: 4, noise: 0.12, loops: 3 }),
  simulate('accelerometer, safe speed, 2 loops', { bitMs: SPEEDS.safe, sensor: 'accel', jitter: 4, noise: 0.12, loops: 2 }),
  simulate('accelerometer, safe, weak contact, 3 loops', { bitMs: SPEEDS.safe, sensor: 'accel', jitter: 4, noise: 0.25, loops: 3 }),
  simulate('accelerometer, SENSOR speed, 1 loop', { bitMs: SPEEDS.sensor, sensor: 'accel', jitter: 4, noise: 0.12 }),
  simulate('accelerometer, SENSOR speed, weak, 2 loops', { bitMs: SPEEDS.sensor, sensor: 'accel', jitter: 4, noise: 0.25, loops: 2 }),
  simulate('timer jitter 12 ms + clock drift 300 ppm', { bitMs: SPEEDS.normal, sensor: 'mic', callJitter: 12, timerDrift: 300 }),
];
assert.ok([0, 1, 2, 6, 8].every((i) => res[i]), 'mic scenarios, timer jitter and accelerometer at sensor speed decode');
console.log('VIBE TESTS PASSED');
