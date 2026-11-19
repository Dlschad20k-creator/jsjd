import { spawnSync } from 'node:child_process';
let failed = 0;
for (const f of ['rs.test.mjs', 'sound.test.mjs', 'vibe.test.mjs']) {
  console.log(`\n### ${f}`);
  const r = spawnSync(process.execPath, [new URL(f, import.meta.url).pathname], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
