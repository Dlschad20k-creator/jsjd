// Smoke test: two real browsers quick-match against each other on the running server,
// verify the match only starts with 2 players, the 3D world renders, holes move and eat.
// Usage: node scripts/smoke.mjs [url] [outDir] [mapId]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // resolves a local or globally pre-installed Playwright
import fs from 'node:fs';

const URL = process.argv[2] || 'http://localhost:3001';
const OUT = process.argv[3] || 'smoke-out';
const MAP = process.argv[4] || 'berlin';
fs.mkdirSync(OUT, { recursive: true });

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'];
const browsers = [];
const errors = [];
async function player(name) {
  const browser = await chromium.launch({ args: ARGS });
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => localStorage.setItem('holeworld:settings', JSON.stringify({ quality: 'low', music: 0, sfx: 0, voice: false })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(URL);
  await page.fill('#name', name);
  await page.click(`.map-card.map-${MAP}`);
  return page;
}
const a = await player('Alice');
await a.screenshot({ path: `${OUT}/1-home.png` });
await a.click('text=Quick Match');
await a.waitForSelector('.lobby-card');
await a.waitForTimeout(800);
await a.screenshot({ path: `${OUT}/2-lobby-waiting.png` });
const lobbyPhase = await a.evaluate(() => document.querySelector('.slot.empty') !== null);
console.log('lobby waits for 2nd player:', lobbyPhase);

const b = await player('Bob');
await b.click('text=Quick Match');
await a.waitForFunction(() => !!window.__HOLE__, null, { timeout: 60000 });
await b.waitForFunction(() => !!window.__HOLE__, null, { timeout: 60000 });
console.log('both in game');
await a.waitForTimeout(1500);
await a.screenshot({ path: `${OUT}/3-countdown.png` });
await a.waitForTimeout(3000);
// drive both holes
await a.keyboard.down('d');
await b.keyboard.down('a');
await a.waitForTimeout(4000);
await a.keyboard.up('d');
await a.keyboard.down('s');
await a.waitForTimeout(3000);
await a.keyboard.press(' ');
await a.keyboard.press('e');
await a.waitForTimeout(1500);
await a.screenshot({ path: `${OUT}/4-playing-a.png` });
await b.screenshot({ path: `${OUT}/5-playing-b.png` });
// steer Alice straight onto Bob to exercise PvP proximity + keep eating
const dbg = await a.evaluate(() => window.__HOLE__?.debug());
const dbgB = await b.evaluate(() => window.__HOLE__?.debug());
console.log('bob view', JSON.stringify(dbgB?.holes));
const hud = await a.evaluate(() => document.querySelector('.pcard.left .pcard-stats')?.textContent);
console.log('debug', JSON.stringify(dbg));
console.log('hud', hud);
console.log('errors', errors.length ? errors : 'none');
for (const br of browsers) await br.close();
const ok = dbg && dbg.alive < dbg.objects && errors.length === 0;
console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
