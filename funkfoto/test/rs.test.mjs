import assert from 'node:assert/strict';
import { rsEncode, rsDecode } from '../js/rs.js';
let rnd = 12345;
const r = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) / 2 ** 32);
for (const [k, nsym] of [[70, 20], [24, 6], [10, 4], [200, 40]]) {
  for (let trial = 0; trial < 300; trial++) {
    const msg = Uint8Array.from({ length: k }, () => Math.floor(r() * 256));
    const cw = rsEncode(msg, nsym);
    const bad = cw.slice();
    const nerr = Math.floor(r() * (nsym / 2 + 1));
    const used = new Set();
    while (used.size < nerr) used.add(Math.floor(r() * cw.length));
    for (const p of used) bad[p] ^= 1 + Math.floor(r() * 255);
    const d = rsDecode(bad, nsym);
    assert.ok(d, `decode failed k=${k} nsym=${nsym} errs=${nerr}`);
    assert.deepEqual(d.data, msg);
    assert.equal(d.corrected, nerr);
  }
  // too many errors must not silently return the wrong message (mostly null)
  let wrong = 0;
  for (let trial = 0; trial < 200; trial++) {
    const msg = Uint8Array.from({ length: k }, () => Math.floor(r() * 256));
    const bad = rsEncode(msg, nsym);
    for (let i = 0; i < nsym; i++) bad[Math.floor(r() * bad.length)] ^= 0x55;
    const d = rsDecode(bad, nsym);
    if (d && d.data.some((v, i) => v !== msg[i])) wrong++;
  }
  console.log(`RS(${k + nsym},${k}) ok; miscorrections with overload: ${wrong}/200`);
}
console.log('RS TESTS PASSED');
