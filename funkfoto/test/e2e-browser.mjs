// Browser end-to-end test (needs Playwright + Chromium and the site served on BASE):
//  1. sender page: real photo -> compress -> transmit audio (sound) / vibration timeline (vibe)
//  2. Node: simulate the air/contact channel and write a WAV
//  3. receiver page: Chrome uses the WAV as its microphone; wait for the finished photo; compare bytes
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || 'e2e-out';
const MODE = process.argv[2] || 'sound';
fs.mkdirSync(OUT, { recursive: true });
const SR = 48000;
let seed = 3;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

function writeWav(file, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl'] });
// a colourful test "photo"
const photoPage = await browser.newPage({ viewport: { width: 640, height: 480 } });
await photoPage.setContent(`<body style="margin:0;background:linear-gradient(135deg,#ff5a1f,#ffd400 40%,#0f8a6d 70%,#1a5fb4)">
  <div style="position:absolute;left:180px;top:120px;width:260px;height:260px;border-radius:50%;background:#fff;box-shadow:0 0 0 30px #1d1916"></div>
  <div style="position:absolute;left:60px;top:40px;font:900 90px Arial;color:#1d1916">HI!</div></body>`);
const photo = path.join(OUT, 'photo.png');
await photoPage.screenshot({ path: photo });

// ---- sender
const tx = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
tx.on('pageerror', (e) => console.log('TX PAGEERR', e.message));
await tx.goto(BASE);
if (MODE === 'vibe') await tx.click('#ch-vibe');
await tx.click('#go-send');
if (MODE === 'vibe') await tx.click('#s-seg button:nth-child(1)'); // 16x16 keeps the test short
await tx.setInputFiles('#pick', photo);
await tx.waitForFunction(() => window.__funkfoto.S.prepared, null, { timeout: 10000 });
await tx.waitForTimeout(300);
await tx.screenshot({ path: path.join(OUT, `${MODE}-1-sender.png`), fullPage: true });
const sent = await tx.evaluate(() => Array.from(window.__funkfoto.S.prepared.bytes));
console.log(`${MODE}: sending ${sent.length} bytes`);

let wave;
if (MODE === 'sound') {
  const b64 = await tx.evaluate(async (bytes) => {
    const { encodeFile } = await import('./js/sound.js');
    const enc = encodeFile(Uint8Array.from(bytes), 48000);
    const u8 = new Uint8Array(enc.audio.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, sent);
  const audio = new Float32Array(Uint8Array.from(Buffer.from(b64, 'base64')).buffer);
  // channel: 1.5 s silence, room echo, attenuation, noise
  wave = new Float32Array(Math.round(SR * 1.5) + audio.length + SR * 3);
  const off = Math.round(SR * 1.5);
  for (let i = 0; i < audio.length; i++) {
    const v = audio[i] * 0.25;
    wave[off + i] += v;
    if (off + i + 240 < wave.length) wave[off + i + 240] += v * 0.45; // 5 ms echo
    if (off + i + 720 < wave.length) wave[off + i + 720] += v * 0.25; // 15 ms echo
  }
  for (let i = 0; i < wave.length; i++) wave[i] += 0.02 * gauss();
} else {
  const speed = 90;
  const tl = await tx.evaluate(async ([bytes, speed]) => {
    const { vibeTimeline } = await import('./js/vibe.js');
    return vibeTimeline(Uint8Array.from(bytes), speed, 7).packets;
  }, [sent, speed]);
  const segs = [[false, 1500], ...tl.flat(), [false, 3000]];
  const total = segs.reduce((a, s) => a + s[1], 0);
  wave = new Float32Array(Math.round((total / 1000) * SR));
  let amp = 0, i = 0, ph = 0;
  for (const [on, ms] of segs) {
    const n = Math.round((ms / 1000) * SR);
    for (let k = 0; k < n && i < wave.length; k++, i++) {
      amp += ((on ? 1 : 0) - amp) / (SR * (on ? 0.022 : 0.04)); // motor spin up/down
      ph += (2 * Math.PI * 175) / SR;
      // buzz heard through the phone body: fundamental + harmonic, plus room noise
      wave[i] = amp * (0.12 * Math.sin(ph) + 0.05 * Math.sin(2 * ph + 1)) + 0.01 * gauss();
    }
  }
}
const wav = path.resolve(OUT, `${MODE}.wav`);
writeWav(wav, wave);
console.log(`${MODE}: wrote ${(wave.length / SR).toFixed(1)} s of "microphone" audio`);

// ---- receiver: Chrome plays the WAV into getUserMedia
const rxBrowser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`, '--autoplay-policy=no-user-gesture-required'],
});
const rx = await (await rxBrowser.newContext({ viewport: { width: 400, height: 860 }, permissions: ['microphone'] })).newPage();
rx.on('pageerror', (e) => console.log('RX PAGEERR', e.message));
await rx.goto(BASE);
if (MODE === 'vibe') await rx.click('#ch-vibe');
await rx.click('#go-recv');
const t0 = Date.now();
await rx.click('#rx-start');
await rx.waitForTimeout(MODE === 'sound' ? 9000 : 25000);
await rx.screenshot({ path: path.join(OUT, `${MODE}-2-receiving.png`), fullPage: true });
let ok = false;
try {
  await rx.waitForSelector('#rx-done:not([hidden])', { timeout: (wave.length / SR) * 1000 + 20000 });
  ok = true;
} catch {
  console.log('status:', await rx.textContent('#rx-status'));
}
await rx.screenshot({ path: path.join(OUT, `${MODE}-3-done.png`), fullPage: true });
let same = false;
if (ok) {
  const got = await rx.evaluate(async () => {
    const a = document.getElementById('rx-save');
    return Array.from(new Uint8Array(await (await fetch(a.href)).arrayBuffer()));
  });
  if (MODE === 'sound') same = got.length === sent.length && got.every((v, i) => v === sent[i]);
  else {
    // receiver saves an upscaled PNG; compare the decoded 1-bit picture instead
    same = await rx.evaluate((sent) => {
      const c = document.getElementById('rx-img-bits');
      return c && c.width === sent[0] * 12 && c.height === sent[1] * 12;
    }, sent);
  }
  console.log(`${MODE}: received in ${((Date.now() - t0) / 1000).toFixed(0)} s – ${await rx.textContent('#rx-meta')}`);
}
console.log(ok && same ? `E2E ${MODE.toUpperCase()} PASS` : `E2E ${MODE.toUpperCase()} FAIL`);
await browser.close();
await rxBrowser.close();
process.exit(ok && same ? 0 : 1);
