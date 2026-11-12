/**
 * Fully synthesised audio (no samples, no licensing): Web Audio SFX for every
 * object material + a procedural music sequencer with a distinct style per map.
 * Gameplay code triggers sounds through `sfx.play(event)` — never touches nodes.
 */
import type { MapId } from '@shared/protocol';
import type { Sfx } from '@shared/maps';

type Ctx = AudioContext;

class AudioEngine {
  ctx: Ctx | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private comp!: DynamicsCompressorNode;
  private noiseBuf!: AudioBuffer;
  private music: Sequencer | null = null;
  private sfxVol = 0.8;
  private musicVol = 0.5;
  private lastPlay = new Map<string, number>();
  voice = true;
  lang: 'en' | 'de' = 'en';

  /** Must be called from a user gesture (iOS Safari requirement). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.musicBus.gain.value = this.musicVol;
      this.sfxBus.connect(this.comp);
      this.musicBus.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (this.ctx) {
      this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
      this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
    }
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------- primitives ----------
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, t = this.now, dest?: AudioNode, attack = 0.005) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, attack, vol, dur);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + attack + 0.05);
  }

  noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, q = 1, t = this.now, dest?: AudioNode) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, vol, dur);
    s.connect(f).connect(g).connect(dest ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  private throttle(key: string, ms: number) {
    const n = performance.now();
    if ((this.lastPlay.get(key) ?? 0) + ms > n) return false;
    this.lastPlay.set(key, n);
    return true;
  }

  // ---------- game sounds ----------
  /** Swallow sound: material flavour + size-dependent pitch + a satisfying gulp. */
  eat(kind: Sfx | undefined, r: number, combo: number, mine: boolean) {
    if (!this.ctx || !this.throttle('eat' + (mine ? 'm' : 'o'), 35)) return;
    const vol = mine ? 1 : 0.35;
    const size = Math.min(1, r / 8);
    const p = 1.6 - size * 1.1 + Math.random() * 0.15; // bigger = lower
    const t = this.now;
    // gulp body
    this.tone('sine', 220 * p, 60 * p, 0.18 + size * 0.3, 0.45 * vol, t);
    switch (kind) {
      case 'crunch':
        this.noise(0.09 + size * 0.15, 0.5 * vol, 'bandpass', 2400 * p, 600, 1.4, t);
        this.noise(0.05, 0.3 * vol, 'highpass', 5000, 3000, 0.7, t + 0.04);
        break;
      case 'squeak':
        this.tone('square', 900 * p, 1800 * p, 0.09, 0.12 * vol, t);
        this.tone('sine', 1500 * p, 700 * p, 0.12, 0.15 * vol, t + 0.06);
        break;
      case 'honk':
        this.tone('sawtooth', 330 * p, 320 * p, 0.16, 0.12 * vol, t);
        this.tone('sawtooth', 415 * p, 400 * p, 0.16, 0.1 * vol, t);
        this.noise(0.25 + size * 0.2, 0.35 * vol, 'lowpass', 1800, 200, 1, t + 0.05);
        break;
      case 'boing':
        this.tone('sine', 180 * p, 700 * p, 0.12, 0.3 * vol, t);
        this.tone('sine', 700 * p, 260 * p, 0.25, 0.22 * vol, t + 0.1);
        break;
      case 'glass':
        this.tone('sine', 2600 * p, 2500 * p, 0.25, 0.12 * vol, t);
        this.tone('sine', 3900 * p, 3800 * p, 0.2, 0.08 * vol, t + 0.02);
        this.noise(0.12, 0.25 * vol, 'highpass', 6000, 4000, 0.8, t);
        break;
      case 'metal':
        this.tone('square', 520 * p, 480 * p, 0.2, 0.06 * vol, t);
        this.tone('triangle', 1370 * p, 1300 * p, 0.35, 0.1 * vol, t);
        this.noise(0.08, 0.3 * vol, 'bandpass', 3500, 2000, 3, t);
        break;
      case 'splat':
        this.noise(0.18 + size * 0.1, 0.5 * vol, 'lowpass', 1200 * p, 150, 2, t);
        this.tone('sine', 400 * p, 90, 0.12, 0.25 * vol, t);
        break;
      case 'thud':
      default:
        this.tone('sine', 110 * p, 40, 0.3 + size * 0.4, 0.5 * vol, t);
        this.noise(0.25 + size * 0.5, 0.45 * vol, 'lowpass', 900, 80, 1, t);
    }
    if (size > 0.45) {
      // building collapse rumble
      this.noise(1.2, 0.5 * vol, 'lowpass', 400, 40, 1, t);
      this.tone('sine', 55, 30, 1.0, 0.5 * vol, t);
    }
    if (mine && combo >= 3) {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const n = scale[Math.min(scale.length - 1, Math.floor(combo / 3))];
      this.tone('triangle', 523 * Math.pow(2, n / 12), 523 * Math.pow(2, n / 12), 0.12, 0.08, t + 0.03);
    }
  }

  levelUp() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 4, 7, 12, 16].forEach((n, i) => this.tone('triangle', 392 * Math.pow(2, n / 12), 392 * Math.pow(2, n / 12), 0.16, 0.16, t + i * 0.06));
    this.noise(0.5, 0.12, 'highpass', 8000, 3000, 0.5, t + 0.2);
  }

  kill(mapId: MapId) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone('sine', 120, 30, 0.9, 0.9, t);
    this.noise(0.8, 0.5, 'lowpass', 3000, 60, 1, t);
    if (mapId === 'berlin') {
      // meme air-horn (synth): three stabs
      for (let i = 0; i < 3; i++)
        for (const f of [466, 554, 698]) this.tone('sawtooth', f, f * 0.98, 0.13, 0.08, t + 0.15 + i * 0.16, undefined, 0.01);
    } else if (mapId === 'pink') {
      [0, 7, 12, 19, 24].forEach((n, i) => this.tone('sine', 880 * Math.pow(2, n / 12), 880 * Math.pow(2, n / 12), 0.3, 0.12, t + 0.1 + i * 0.05));
    } else {
      this.tone('sine', 300, 1200, 0.2, 0.3, t + 0.1);
      this.tone('sine', 1200, 400, 0.35, 0.25, t + 0.3);
    }
  }

  died() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone('sawtooth', 440, 55, 1.0, 0.18, t);
    this.tone('square', 220, 40, 1.1, 0.08, t + 0.05);
    this.noise(0.9, 0.3, 'lowpass', 2000, 100, 4, t);
  }

  powerup() {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 8; i++) this.tone('sine', 600 + i * 180, 620 + i * 180, 0.08, 0.1, t + i * 0.03);
  }

  dash() {
    if (!this.ctx) return;
    this.noise(0.35, 0.45, 'bandpass', 400, 3000, 2);
  }

  vortex() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(0.9, 0.5, 'bandpass', 200, 2500, 3, t);
    this.tone('sine', 50, 140, 0.8, 0.6, t);
  }

  upgrade() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone('square', 660, 990, 0.1, 0.08, t);
    this.tone('triangle', 990, 1320, 0.14, 0.1, t + 0.08);
  }

  beep(high = false) {
    this.tone('square', high ? 880 : 440, high ? 880 : 440, high ? 0.4 : 0.12, 0.12);
  }

  click() {
    if (!this.ctx || !this.throttle('click', 40)) return;
    this.tone('triangle', 900, 1200, 0.05, 0.06);
  }

  join() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 5, 9, 12].forEach((n, i) => this.tone('triangle', 523 * Math.pow(2, n / 12), 523 * Math.pow(2, n / 12), 0.18, 0.12, t + i * 0.08));
  }

  win() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => this.tone('triangle', 392 * Math.pow(2, n / 12), 392 * Math.pow(2, n / 12), 0.22, 0.14, t + i * 0.09));
  }

  lose() {
    if (!this.ctx) return;
    const t = this.now;
    [7, 6, 5, 0].forEach((n, i) => this.tone('sawtooth', 220 * Math.pow(2, n / 12), 220 * Math.pow(2, n / 12), 0.35, 0.08, t + i * 0.3));
  }

  /** Funny voice lines via the browser's speech engine (optional, toggle in settings). */
  say(text: string) {
    if (!this.voice || typeof speechSynthesis === 'undefined' || !this.throttle('say', 2500)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = /[äöüß]|Digga|Vallah|Wallah|Bruder|Lan|Ich|Ehren|Läuft|Pfand/i.test(text) ? 'de-DE' : this.lang === 'de' ? 'de-DE' : 'en-US';
      u.rate = 1.15;
      u.pitch = 1.3;
      u.volume = 0.8;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* speech is optional */
    }
  }

  // ---------- music ----------
  playMusic(style: MapId | 'menu') {
    if (!this.ctx) return;
    if (this.music?.style === style) return;
    this.music?.stop();
    this.music = new Sequencer(this, style);
    this.music.start();
  }

  stopMusic() {
    this.music?.stop();
    this.music = null;
  }

  setIntensity(v: number) {
    if (this.music) this.music.intensity = v;
  }
}

/** Look-ahead step sequencer. 16 steps per bar. */
class Sequencer {
  style: MapId | 'menu';
  intensity = 0;
  private a: AudioEngine;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bar = 0;
  private out: GainNode;
  private filter: BiquadFilterNode;

  constructor(a: AudioEngine, style: MapId | 'menu') {
    this.a = a;
    this.style = style;
    const ctx = a.ctx!;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.out.connect(this.filter).connect(a.musicBus);
  }

  get bpm() {
    return this.style === 'berlin' ? 128 : this.style === 'bunny' ? 92 : this.style === 'pink' ? 116 : 100;
  }

  start() {
    const ctx = this.a.ctx!;
    this.nextTime = ctx.currentTime + 0.1;
    this.out.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    const ctx = this.a.ctx!;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    const out = this.out;
    setTimeout(() => out.disconnect(), 1500);
  }

  private schedule() {
    const ctx = this.a.ctx!;
    const spb = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  private kick(t: number, v = 0.9) {
    this.a.tone('sine', 150, 42, 0.32, v, t, this.out, 0.002);
  }
  private hat(t: number, open = false, v = 0.12) {
    this.a.noise(open ? 0.14 : 0.04, v, 'highpass', 8000, 7000, 0.8, t, this.out);
  }
  private clap(t: number, v = 0.25) {
    this.a.noise(0.12, v, 'bandpass', 1800, 1200, 1.5, t, this.out);
  }

  private playStep(s: number, t: number, spb: number) {
    const hi = this.intensity > 0.5;
    if (this.style === 'berlin') {
      // Berlin techno: four-on-the-floor, offbeat hats, rolling acid bass
      if (s % 4 === 0) this.kick(t, 0.95);
      if (s % 4 === 2) this.hat(t, true, 0.1);
      if (hi && s % 2 === 1) this.hat(t, false, 0.06);
      if (s === 4 || s === 12) this.clap(t, 0.18);
      const roots = [41, 41, 44, 39];
      const root = roots[this.bar % 4];
      const acid = [0, 0, 12, 0, 3, 0, 15, 0, 0, 7, 0, 12, 0, 3, 10, 0];
      if (s % 4 !== 0) {
        const f = 440 * Math.pow(2, (root + acid[s] - 69) / 12);
        const ctx = this.a.ctx!;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.Q.value = 12;
        const sweep = 400 + (Math.sin(this.bar * 0.7 + s * 0.2) * 0.5 + 0.5) * (hi ? 2600 : 1600);
        flt.frequency.setValueAtTime(sweep, t);
        flt.frequency.exponentialRampToValueAtTime(180, t + spb * 0.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.95);
        o.connect(flt).connect(g).connect(this.out);
        o.start(t);
        o.stop(t + spb);
      }
      if (this.bar % 4 === 3 && s === 14) for (const n of [0, 3, 7]) this.a.tone('square', 440 * Math.pow(2, (root + 24 + n - 69) / 12), 440 * Math.pow(2, (root + 24 + n - 69) / 12), 0.25, 0.04, t, this.out);
      return;
    }
    if (this.style === 'pink') {
      // bubbly pop: I–V–vi–IV
      const prog = [
        [60, 64, 67],
        [67, 71, 74],
        [69, 72, 76],
        [65, 69, 72],
      ];
      const ch = prog[this.bar % 4];
      if (s % 4 === 0) this.kick(t, 0.55);
      if (s === 4 || s === 12) this.clap(t, 0.2);
      if (s % 2 === 1) this.hat(t, false, hi ? 0.08 : 0.05);
      if (s % 4 === 2 || s === 0) {
        const f = 440 * Math.pow(2, (ch[0] - 24 - 69) / 12);
        this.a.tone('triangle', f, f, spb * 1.6, 0.22, t, this.out);
      }
      const arp = [0, 1, 2, 1, 2, 0, 1, 2];
      if (s % 2 === 0) {
        const n = ch[arp[(s / 2) % 8]] + 12;
        const f = 440 * Math.pow(2, (n - 69) / 12);
        this.a.tone('square', f, f, spb * 0.8, 0.035, t, this.out);
        this.a.tone('sine', f * 2, f * 2, spb * 0.6, 0.03, t, this.out);
      }
      if (s === 0) for (const n of ch) this.a.tone('sine', 440 * Math.pow(2, (n - 69) / 12), 440 * Math.pow(2, (n - 69) / 12), spb * 14, 0.03, t, this.out, 0.3);
      return;
    }
    if (this.style === 'bunny') {
      // music box lullaby: pentatonic melody, soft pulse
      const penta = [0, 2, 4, 7, 9, 12, 14, 16];
      const prog = [60, 65, 57, 62];
      const root = prog[this.bar % 4];
      if (s % 8 === 0) this.kick(t, 0.25);
      if (hi && s % 4 === 2) this.hat(t, false, 0.04);
      if (s % 2 === 0) {
        const idx = (s * 3 + this.bar * 5 + ((s * 7) % 5)) % penta.length;
        if ((s + this.bar) % 6 !== 5) {
          const f = 440 * Math.pow(2, (root + 12 + penta[idx] - 69) / 12);
          this.a.tone('sine', f, f, 0.6, 0.08, t, this.out, 0.002);
          this.a.tone('sine', f * 3, f * 3, 0.25, 0.015, t, this.out, 0.002);
        }
      }
      if (s === 0 || s === 8) {
        const f = 440 * Math.pow(2, (root - 12 - 69) / 12);
        this.a.tone('triangle', f, f, spb * 7, 0.12, t, this.out, 0.05);
      }
      return;
    }
    // menu: chill synthwave pulse
    const prog = [57, 53, 60, 55];
    const root = prog[this.bar % 4];
    if (s % 4 === 0) this.kick(t, 0.4);
    if (s % 4 === 2) this.hat(t, true, 0.05);
    if (s % 2 === 0) {
      const f = 440 * Math.pow(2, (root - 24 - 69) / 12);
      this.a.tone('sawtooth', f, f, spb * 0.9, 0.05, t, this.out);
    }
    if (s === 0) for (const n of [0, 3, 7, 10]) this.a.tone('triangle', 440 * Math.pow(2, (root + n - 69) / 12), 440 * Math.pow(2, (root + n - 69) / 12), spb * 15, 0.03, t, this.out, 0.4);
    if (s % 4 === 1 && (this.bar + s) % 3 === 0) {
      const f = 440 * Math.pow(2, (root + 12 + [0, 3, 7, 10, 12][(s + this.bar) % 5] - 69) / 12);
      this.a.tone('sine', f, f, 0.4, 0.05, t, this.out);
    }
  }
}

export const sfx = new AudioEngine();
