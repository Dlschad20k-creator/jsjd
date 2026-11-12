// Starts a throwaway server with short timings and runs the protocol e2e test against it.
import { spawn } from 'node:child_process';
const env = { ...process.env, PORT: '3011', HW_MATCH_SECONDS: '8', HW_GRACE_SECONDS: '4', DATA_DIR: 'server/.e2e-data' };
const srv = spawn('node', ['server/dist/index.js'], { env, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 1200));
const t = spawn('npx', ['tsx', 'server/test/e2e.protocol.ts'], { env: { ...env, URL: 'http://localhost:3011' }, stdio: 'inherit' });
t.on('exit', (code) => {
  srv.kill();
  process.exit(code ?? 1);
});
