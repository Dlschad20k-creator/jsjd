/** Tiny JSON-file leaderboard. Free and dependency-less; on hosts with ephemeral
 * disks (e.g. Render free tier) it resets on redeploy — set DATA_DIR to a persistent volume to keep it. */
import fs from 'node:fs';
import path from 'node:path';
import type { LeaderEntry } from '../../shared/src/protocol';

const MAX = 100;

export class Leaderboard {
  private entries: LeaderEntry[] = [];
  private file: string;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(dir: string) {
    this.file = path.join(dir, 'leaderboard.json');
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (Array.isArray(data)) this.entries = data.slice(0, MAX);
      }
    } catch (e) {
      console.warn('[leaderboard] could not load, starting fresh:', (e as Error).message);
    }
  }

  add(e: LeaderEntry) {
    if (e.score <= 0) return;
    this.entries.push(e);
    this.entries.sort((a, b) => b.score - a.score);
    this.entries = this.entries.slice(0, MAX);
    this.scheduleSave();
  }

  top(n = 25) {
    return this.entries.slice(0, n);
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      fs.promises.writeFile(this.file, JSON.stringify(this.entries)).catch((err) => console.warn('[leaderboard] save failed:', err.message));
    }, 1000);
  }
}
