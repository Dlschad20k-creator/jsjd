import { encodeFile, estimateSeconds, packetCount, SoundRx, SOUND } from './sound.js';
import { SPEEDS, VIBE, VibeRx, vibeTimeline, vibrateCalls, vibePacketCount, vibePacketMs } from './vibe.js';
import { Assembler } from './common.js';
import { SOUND_PRESETS, VIBE_SIZES, compressForSound, detectMime, ditherForVibe, loadImage, paintBits } from './image.js';

const $ = (id) => document.getElementById(id);
const S = {
  channel: 'sound',
  img: null,
  prepared: null,
  quality: 'normal',
  vsize: 24,
  speed: 'normal',
  sensor: 'mic',
  stopTx: null,
  stopRx: null,
};
const canVibrate = typeof navigator.vibrate === 'function';
const SPEED_INFO = {
  fast: ['Schnell', '65 ms/Bit'],
  normal: ['Normal', '90 ms/Bit'],
  safe: ['Sicher', '130 ms/Bit'],
  sensor: ['Sensor', '200 ms/Bit'],
};

// ---------- helpers ----------
function fmtTime(s) {
  s = Math.round(s);
  return s < 90 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`;
}
function seg(el, options, current, onPick) {
  el.textContent = '';
  for (const [key, title, sub] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(key === current));
    b.append(title);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      b.append(s);
    }
    b.onclick = () => {
      for (const x of el.children) x.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      onPick(key);
    };
    el.append(b);
  }
}
function grid(el, n, have = () => false) {
  if (el.children.length !== n) {
    el.textContent = '';
    for (let i = 0; i < n; i++) el.append(document.createElement('i'));
  }
  [...el.children].forEach((c, i) => c.classList.toggle('on', !!have(i)));
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* optional */
  }
}
function audioSession(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type; // Safari: play even with the silent switch on
  } catch {
    /* optional */
  }
}

// ---------- navigation ----------
function show(view) {
  for (const v of ['home', 'send', 'recv']) $(v).hidden = v !== view;
  $('back').hidden = view === 'home';
  window.scrollTo(0, 0);
}
function stopAll() {
  S.stopTx?.();
  S.stopRx?.();
}
$('back').onclick = () => {
  stopAll();
  show('home');
};

function setChannel(ch) {
  S.channel = ch;
  $('ch-sound').setAttribute('aria-pressed', String(ch === 'sound'));
  $('ch-vibe').setAttribute('aria-pressed', String(ch === 'vibe'));
  if (ch === 'sound') {
    $('send-hint').textContent = 'Foto aufnehmen und als Töne abspielen.';
    $('recv-hint').textContent = 'Mikrofon an – das Handy hört die Töne und setzt das Foto zusammen.';
    $('home-note').innerHTML = '<strong>So geht’s:</strong> Beide Handys 10–50 cm auseinander, Sender auf volle Lautstärke. Ruhige Umgebung hilft. iPhone: Lautlos-Schalter aus. Ein Foto dauert etwa 20–60 Sekunden.';
  } else {
    $('send-hint').textContent = 'Ein Mini-Bild als Vibrationsmuster senden (nur Android).';
    $('recv-hint').textContent = 'Das Sender-Handy auf dieses Handy legen und das Summen mitlesen.';
    $('home-note').innerHTML = '<strong>So geht’s:</strong> Sender-Handy (Android, Chrome) direkt <strong>auf</strong> das Empfänger-Handy legen. Vibration ist sehr langsam: ein 24×24-Bild braucht etwa 1,5–2 Minuten. Empfangen geht auch mit dem iPhone.';
  }
}
$('ch-sound').onclick = () => setChannel('sound');
$('ch-vibe').onclick = () => setChannel('vibe');
setChannel('sound');

// ---------- SEND ----------
$('go-send').onclick = () => {
  const vibe = S.channel === 'vibe';
  $('send-title').textContent = vibe ? 'Mini-Bild per Vibration senden' : 'Foto per Ton senden';
  $('opt-sound').hidden = vibe;
  $('opt-vibe').hidden = !vibe;
  $('vibe-unsupported').hidden = !vibe || canVibrate;
  $('tx-live').hidden = true;
  show('send');
  void prepare();
};
seg($('q-seg'), Object.entries(SOUND_PRESETS).map(([k, p]) => [k, p.label, `${p.max} px`]), S.quality, (k) => {
  S.quality = k;
  void prepare();
});
seg($('s-seg'), Object.entries(VIBE_SIZES).map(([k, l]) => [Number(k), l, k === '24' ? 'empfohlen' : '']), S.vsize, (k) => {
  S.vsize = k;
  void prepare();
});
seg($('v-seg'), Object.entries(SPEED_INFO).map(([k, [t, s]]) => [k, t, s]), S.speed, (k) => {
  S.speed = k;
  void prepare();
});

async function onFile(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    S.img = await loadImage(f);
    $('orig').src = S.img.src;
    $('previews').hidden = false;
    await prepare();
  } catch (err) {
    alertNote(err.message);
  }
}
$('cam').onchange = onFile;
$('pick').onchange = onFile;

function alertNote(msg) {
  $('tx-help').textContent = msg;
}

async function prepare() {
  const vibe = S.channel === 'vibe';
  $('tx-start').disabled = true;
  if (!S.img) {
    $('facts').hidden = true;
    return;
  }
  if (vibe) {
    const d = ditherForVibe(S.img, S.vsize);
    S.prepared = { bytes: d.bytes };
    paintBits($('prev-vibe'), d.bytes);
    $('prev-vibe').hidden = false;
    $('prev-sound').hidden = true;
    $('prev-cap').textContent = `So kommt es an · ${d.w}×${d.h} Pixel, schwarz-weiß`;
    const n = vibePacketCount(d.bytes.length);
    $('f-bytes').textContent = d.bytes.length;
    $('f-packets').textContent = n;
    $('f-time').textContent = fmtTime((n * vibePacketMs(SPEEDS[S.speed])) / 1000);
  } else {
    const c = await compressForSound(S.img, S.quality);
    S.prepared = { bytes: c.bytes };
    $('prev-sound').src = c.url;
    $('prev-sound').hidden = false;
    $('prev-vibe').hidden = true;
    $('prev-cap').textContent = `So kommt es an · ${c.w}×${c.h} px, ${c.mime.split('/')[1].toUpperCase()}`;
    $('f-bytes').textContent = c.bytes.length;
    $('f-packets').textContent = packetCount(c.bytes.length);
    $('f-time').textContent = fmtTime(estimateSeconds(c.bytes.length));
  }
  $('facts').hidden = false;
  $('tx-start').disabled = vibe && !canVibrate;
}

$('tx-start').onclick = async () => {
  if (!S.prepared) return;
  stopAll();
  $('tx-live').hidden = false;
  $('tx-start').disabled = true;
  await keepAwake(true);
  try {
    if (S.channel === 'sound') await startSoundTx(S.prepared.bytes);
    else startVibeTx(S.prepared.bytes);
  } catch (err) {
    $('tx-status').textContent = 'Fehler: ' + err.message;
  }
};
$('tx-stop').onclick = () => S.stopTx?.();

async function startSoundTx(bytes) {
  audioSession('playback');
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  const enc = encodeFile(bytes, ctx.sampleRate);
  const buf = ctx.createBuffer(1, enc.audio.length, ctx.sampleRate);
  buf.getChannelData(0).set(enc.audio);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.15;
  src.start(t0);
  const dur = buf.duration;
  $('tx-help').textContent = 'Lautstärke ganz aufdrehen. Das Empfänger-Handy in die Nähe halten. Der Sender wiederholt alle Pakete, bis du Stopp drückst – verpasste Pakete kommen in der nächsten Runde.';
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const el = Math.max(0, ctx.currentTime - t0);
    const round = Math.floor(el / dur) + 1;
    const pos = (el % dur) * ctx.sampleRate;
    let idx = 0;
    while (idx + 1 < enc.starts.length && enc.starts[idx + 1] <= pos) idx++;
    $('tx-status').textContent = `Runde ${round} · Paket ${idx + 1}/${enc.total} · ${fmtTime(dur)} pro Runde`;
    $('tx-bar').style.width = `${((el % dur) / dur) * 100}%`;
    grid($('tx-grid'), enc.total, (i) => (round > 1 ? true : i < idx));
    [...$('tx-grid').children].forEach((c, i) => c.classList.toggle('now', i === idx));
  };
  tick();
  S.stopTx = () => {
    cancelAnimationFrame(raf);
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    void ctx.close();
    void keepAwake(false);
    $('tx-live').hidden = true;
    $('tx-start').disabled = false;
    S.stopTx = null;
  };
}

function startVibeTx(bytes) {
  const bitMs = SPEEDS[S.speed];
  const tl = vibeTimeline(bytes, bitMs);
  // one round = all packets back to back; each packet = a few navigator.vibrate() calls
  const round = [];
  let t = 0;
  tl.packets.forEach((segs, pi) => {
    for (const c of vibrateCalls(segs)) round.push({ at: t + c.at, pattern: c.pattern, packet: pi });
    t += segs.reduce((a, s) => a + s[1], 0);
  });
  const roundMs = t;
  const start = performance.now() + 400;
  let next = 0;
  let timer = 0;
  let raf = 0;
  const fire = () => {
    const now = performance.now();
    for (;;) {
      const r = Math.floor(next / round.length);
      const ev = round[next % round.length];
      const at = start + r * roundMs + ev.at;
      if (at > now + 3) {
        timer = setTimeout(fire, Math.min(40, at - now - 2));
        return;
      }
      navigator.vibrate(ev.pattern);
      next++;
    }
  };
  fire();
  $('tx-help').textContent = `Lege dieses Handy jetzt mit dem Rücken auf das Empfänger-Handy und lass beide ruhig liegen. ${bitMs} ms pro Bit – das Muster wiederholt sich, bis du Stopp drückst.`;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const el = Math.max(0, performance.now() - start);
    const r = Math.floor(el / roundMs) + 1;
    const inRound = el % roundMs;
    let pi = 0;
    for (const ev of round) if (ev.at <= inRound) pi = ev.packet;
    $('tx-status').textContent = `Runde ${r} · Paket ${pi + 1}/${tl.total} · ${fmtTime(roundMs / 1000)} pro Runde`;
    $('tx-bar').style.width = `${(inRound / roundMs) * 100}%`;
    grid($('tx-grid'), tl.total, (i) => (r > 1 ? true : i < pi));
    [...$('tx-grid').children].forEach((c, i) => c.classList.toggle('now', i === pi));
  };
  tick();
  S.stopTx = () => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    navigator.vibrate(0);
    void keepAwake(false);
    $('tx-live').hidden = true;
    $('tx-start').disabled = false;
    S.stopTx = null;
  };
}

// ---------- RECEIVE ----------
$('go-recv').onclick = () => {
  const vibe = S.channel === 'vibe';
  $('recv-title').textContent = vibe ? 'Mini-Bild per Vibration empfangen' : 'Foto per Ton empfangen';
  $('sensor-pick').hidden = !vibe;
  $('rx-live').hidden = true;
  $('rx-done').hidden = true;
  recvHelp();
  show('recv');
};
function setSensor(s) {
  S.sensor = s;
  $('sn-mic').setAttribute('aria-pressed', String(s === 'mic'));
  $('sn-acc').setAttribute('aria-pressed', String(s === 'acc'));
  recvHelp();
}
$('sn-mic').onclick = () => setSensor('mic');
$('sn-acc').onclick = () => setSensor('acc');
function recvHelp() {
  if (S.channel === 'sound') $('recv-help').textContent = 'Tippe auf „Empfang starten“, erlaube das Mikrofon und starte dann am anderen Handy das Senden.';
  else if (S.sensor === 'mic') $('recv-help').textContent = 'Lege das Sender-Handy auf dieses Handy. Das Mikrofon hört das Summen des Vibrationsmotors. Möglichst leise Umgebung.';
  else $('recv-help').textContent = 'Experimentell: Der Bewegungssensor misst die Vibration (nur ca. 60 Messungen pro Sekunde). Am Sender Tempo „Sensor“ wählen. Kann mehrere Runden brauchen.';
}

$('rx-start').onclick = async () => {
  stopAll();
  $('rx-done').hidden = true;
  $('rx-live').hidden = false;
  $('rx-status').textContent = 'Starte…';
  $('rx-grid').textContent = '';
  $('rx-partial').hidden = true;
  await keepAwake(true);
  try {
    if (S.channel === 'sound') await startSoundRx();
    else if (S.sensor === 'mic') await startVibeRxMic();
    else await startVibeRxMotion();
  } catch (err) {
    $('rx-status').textContent = micError(err);
    $('rx-dot').className = 'dot';
  }
};
$('rx-stop').onclick = () => S.stopRx?.();
$('rx-again').onclick = () => $('rx-start').click();

function micError(err) {
  if (!window.isSecureContext) return 'Mikrofon/Sensor geht nur über https:// – öffne die Seite über ihre https-Adresse.';
  if (err?.name === 'NotAllowedError') return 'Zugriff verweigert. Erlaube das Mikrofon bzw. die Bewegungsdaten in den Browser-Einstellungen und versuche es erneut.';
  if (err?.name === 'NotFoundError') return 'Kein Mikrofon gefunden.';
  return 'Fehler: ' + (err?.message || err);
}

async function openMic(filters) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  audioSession('play-and-record');
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  let node = ctx.createMediaStreamSource(stream);
  const src = node;
  for (const f of filters ?? []) {
    const b = ctx.createBiquadFilter();
    b.type = f[0];
    b.frequency.value = f[1];
    b.Q.value = 0.7;
    node.connect(b);
    node = b;
  }
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(proc);
  proc.connect(mute).connect(ctx.destination);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const close = () => {
    proc.onaudioprocess = null;
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
  return { ctx, proc, analyser, close };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function finishImage(bytes, isBits, meta) {
  $('rx-live').hidden = true;
  $('rx-done').hidden = false;
  const save = $('rx-save');
  if (isBits) {
    const small = document.createElement('canvas');
    paintBits(small, bytes);
    const big = $('rx-img-bits');
    const k = 12;
    big.width = small.width * k;
    big.height = small.height * k;
    const g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, big.width, big.height);
    big.hidden = false;
    $('rx-img').hidden = true;
    big.toBlob((b) => {
      save.href = URL.createObjectURL(b);
      save.download = 'funkfoto.png';
    }, 'image/png');
  } else {
    const mime = detectMime(bytes);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    $('rx-img').src = url;
    $('rx-img').hidden = false;
    $('rx-img-bits').hidden = true;
    save.href = url;
    save.download = 'funkfoto.' + (mime.split('/')[1] || 'bin');
  }
  $('rx-meta').textContent = meta + ' Auf dem iPhone: Bild lange drücken → „Zu Fotos hinzufügen“.';
}

async function startSoundRx() {
  const mic = await openMic();
  const asm = new Assembler();
  let current = null;
  const t0 = performance.now();
  const rx = new SoundRx(mic.ctx.sampleRate, {
    onSync: () => {
      $('rx-status').textContent = current ? `Paket-Signal gehört · ${current.have}/${current.total}` : 'Signal gehört – dekodiere…';
    },
    onPacket: (p, info) => {
      current = asm.add(p);
      grid($('rx-grid'), current.total, (i) => current.parts[i]);
      $('rx-status').textContent = `${current.have}/${current.total} Pakete · Signalgüte ${Math.min(99, Math.round(info.quality * 5))} %`;
      if (current.have === current.total) {
        const bytes = Assembler.join(current, SOUND.payload);
        stop();
        finishImage(bytes, false, `${bytes.length} Bytes in ${fmtTime((performance.now() - t0) / 1000)} empfangen.`);
      }
    },
  });
  mic.proc.onaudioprocess = (e) => rx.push(e.inputBuffer.getChannelData(0));
  $('rx-dot').className = 'dot live';
  $('rx-status').textContent = `Hört zu (${mic.ctx.sampleRate} Hz) – jetzt am anderen Handy senden.`;
  // live spectrogram (waterfall), 0–6 kHz; the data band is marked
  const cv = $('scope');
  const g = cv.getContext('2d');
  const bins = new Uint8Array(mic.analyser.frequencyBinCount);
  const hzPerBin = mic.ctx.sampleRate / mic.analyser.fftSize;
  const maxBin = Math.min(bins.length, Math.round(6000 / hzPerBin));
  let raf = 0;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    mic.analyser.getByteFrequencyData(bins);
    g.drawImage(cv, -3, 0);
    g.fillStyle = scopeBg;
    g.fillRect(cv.width - 3, 0, 3, cv.height);
    for (let y = 0; y < cv.height; y += 2) {
      const v = bins[Math.floor((1 - y / cv.height) * maxBin)] / 255;
      if (v < 0.08) continue;
      g.fillStyle = `rgba(255,${Math.round(90 + v * 140)},${Math.round(31 + v * 60)},${Math.min(1, v * v * 1.4).toFixed(3)})`;
      g.fillRect(cv.width - 3, y, 3, 2);
    }
    const bandTop = (1 - (SOUND.f0 + 64 * SOUND.df) / (maxBin * hzPerBin)) * cv.height;
    const bandBot = (1 - SOUND.f0 / (maxBin * hzPerBin)) * cv.height;
    g.fillStyle = cssVar('--signal');
    g.fillRect(cv.width - 3, bandTop, 3, 2);
    g.fillRect(cv.width - 3, bandBot, 3, 2);
  };
  const scopeBg = cssVar('--scope');
  g.fillStyle = scopeBg;
  g.fillRect(0, 0, cv.width, cv.height);
  draw();
  const stop = () => {
    cancelAnimationFrame(raf);
    mic.close();
    void keepAwake(false);
    $('rx-dot').className = 'dot';
    S.stopRx = null;
  };
  S.stopRx = () => {
    stop();
    $('rx-live').hidden = true;
  };
}

function vibeReceiver(smoothMs) {
  const asm = new Assembler();
  let current = null;
  const t0 = performance.now();
  const stateText = {
    idle: 'Warte auf Vibration…',
    preamble: 'Vibration erkannt – Vorspann…',
    search: 'Suche den Takt…',
    data: 'Empfange Daten',
  };
  let stopFn = () => {};
  const rx = new VibeRx({
    smoothMs,
    onState: (s, v) => {
      $('rx-dot').className = s === 'idle' ? 'dot live' : 'dot busy';
      $('rx-status').textContent = (s === 'data' ? `${stateText.data} · ${Math.round(v.bitMs)} ms/Bit` : stateText[s]) + (current ? ` · ${current.have}/${current.total} Pakete` : '');
    },
    onPacket: (p, info) => {
      current = asm.add(p);
      grid($('rx-grid'), current.total, (i) => current.parts[i]);
      const bytes = Assembler.join(current, VIBE.payload);
      $('rx-partial').hidden = false;
      paintBits($('rx-bits'), bytes, (bi) => !!current.parts[Math.floor(bi / VIBE.payload)]);
      if (current.have === current.total) {
        stopFn();
        finishImage(bytes, true, `${bytes[0]}×${bytes[1]} Pixel in ${fmtTime((performance.now() - t0) / 1000)} empfangen${info.combined > 1 ? ' (gestörte Pakete aus mehreren Runden kombiniert)' : ''}.`);
      }
    },
  });
  // envelope scope: last 8 s with threshold line
  const cv = $('scope');
  const g = cv.getContext('2d');
  let raf = 0;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    g.fillStyle = cssVar('--scope');
    g.fillRect(0, 0, cv.width, cv.height);
    const n = Math.min(rx.n, 1600);
    if (n < 2) return;
    let max = 1e-12;
    for (let k = rx.n - n; k < rx.n; k++) max = Math.max(max, rx.at(k));
    max = Math.max(max, (rx.view.on || 0) * 1.2);
    const y = (v) => cv.height - 8 - (v / max) * (cv.height - 16);
    g.strokeStyle = cssVar('--scope-ink');
    g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const v = rx.at(rx.n - n + k);
      const x = (k / 1600) * cv.width + (cv.width - (n / 1600) * cv.width);
      if (k === 0) g.moveTo(x, y(v));
      else g.lineTo(x, y(v));
    }
    g.stroke();
    if (rx.view.thr && rx.state !== 'idle') {
      g.strokeStyle = cssVar('--signal');
      g.setLineDash([8, 6]);
      g.beginPath();
      g.moveTo(0, y(rx.view.thr));
      g.lineTo(cv.width, y(rx.view.thr));
      g.stroke();
      g.setLineDash([]);
    }
  };
  draw();
  return {
    rx,
    stopDraw: () => cancelAnimationFrame(raf),
    setStop: (f) => (stopFn = f),
  };
}

async function startVibeRxMic() {
  // keep the motor buzz (≈100–900 Hz), drop rumble and hiss
  const mic = await openMic([
    ['highpass', 90],
    ['lowpass', 900],
  ]);
  const v = vibeReceiver(20);
  const sr = mic.ctx.sampleRate;
  let sample = 0;
  const FR = 256;
  mic.proc.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    for (let i = 0; i + FR <= d.length; i += FR) {
      let s = 0;
      for (let k = i; k < i + FR; k++) s += d[k] * d[k];
      sample += FR;
      v.rx.push((sample / sr) * 1000, s / FR);
    }
  };
  $('rx-dot').className = 'dot live';
  $('rx-status').textContent = 'Warte auf Vibration… Sender-Handy jetzt auflegen und starten.';
  const stop = () => {
    v.stopDraw();
    mic.close();
    void keepAwake(false);
    $('rx-dot').className = 'dot';
    S.stopRx = null;
  };
  v.setStop(stop);
  S.stopRx = () => {
    stop();
    $('rx-live').hidden = true;
  };
}

async function startVibeRxMotion() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    const r = await DeviceMotionEvent.requestPermission(); // iOS: must be called from the tap
    if (r !== 'granted') throw Object.assign(new Error('Bewegungsdaten nicht erlaubt'), { name: 'NotAllowedError' });
  }
  const v = vibeReceiver(45);
  let base = null;
  let events = 0;
  const onMotion = (e) => {
    const a = e.acceleration && e.acceleration.x != null ? e.acceleration : e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    const m = Math.hypot(a.x, a.y, a.z);
    base = base === null ? m : base + (m - base) * 0.04;
    events++;
    v.rx.push(e.timeStamp || performance.now(), Math.abs(m - base));
  };
  window.addEventListener('devicemotion', onMotion);
  const check = setTimeout(() => {
    if (!events) $('rx-status').textContent = 'Der Bewegungssensor liefert keine Daten. Nutze stattdessen das Mikrofon.';
  }, 2500);
  $('rx-dot').className = 'dot live';
  $('rx-status').textContent = 'Warte auf Vibration… (Sender: Tempo „Sensor“)';
  const stop = () => {
    clearTimeout(check);
    window.removeEventListener('devicemotion', onMotion);
    v.stopDraw();
    void keepAwake(false);
    $('rx-dot').className = 'dot';
    S.stopRx = null;
  };
  v.setStop(stop);
  S.stopRx = () => {
    stop();
    $('rx-live').hidden = true;
  };
}

// test hook for automated end-to-end checks
window.__funkfoto = { S };
