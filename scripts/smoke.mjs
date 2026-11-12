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

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function player(name, mapIdx) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(URL);
  await page.fill('#name', name);
  await page.click(`.map-card.map-${MAP}`);
  return page;
}
const a = await player('Alice', 0);
await a.screenshot({ path: `${OUT}/1-home.png` });
await a.click('text=Quick Match');
await a.waitForSelector('.lobby-card');
await a.waitForTimeout(800);
await a.screenshot({ path: `${OUT}/2-lobby-waiting.png` });
const lobbyPhase = await a.evaluate(() => document.querySelector('.slot.empty') !== null);
console.log('lobby waits for 2nd player:', lobbyPhase);

const b = await player('Bob', 1);
await b.click('text=Quick Match');
await a.waitForSelector('.game-canvas', { timeout: 15000 });
await b.waitForSelector('.game-canvas', { timeout: 15000 });
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
const dbg = await a.evaluate(() => window.__HOLE__?.debug());
const hud = await a.evaluate(() => document.querySelector('.pcard.left .pcard-stats')?.textContent);
console.log('debug', JSON.stringify(dbg));
console.log('hud', hud);
console.log('errors', errors.length ? errors : 'none');
await browser.close();
const ok = dbg && dbg.alive < dbg.objects && errors.length === 0;
console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
