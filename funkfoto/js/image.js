// Photo preparation: small compressed photo for sound, tiny 1-bit dithered picture for vibration.

export const SOUND_PRESETS = {
  quick: { label: 'Schnell', max: 64, q: 0.5, budget: 1000 },
  normal: { label: 'Normal', max: 96, q: 0.55, budget: 2200 },
  good: { label: 'Gut', max: 128, q: 0.62, budget: 3800 },
};
export const VIBE_SIZES = { 16: '16 × 16', 24: '24 × 24', 32: '32 × 32' };

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img); // browsers apply the photo's EXIF rotation automatically
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    img.src = url;
  });
}

function fit(w, h, max) {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

function draw(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));

/** Smallest good-looking encoding (WebP if the browser can write it, else JPEG) within the preset budget. */
export async function compressForSound(img, presetKey) {
  const p = SOUND_PRESETS[presetKey];
  const [w, h] = fit(img.naturalWidth, img.naturalHeight, p.max);
  const c = draw(img, w, h);
  let q = p.q;
  let blob;
  for (let i = 0; i < 6; i++) {
    blob = await toBlob(c, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(c, 'image/jpeg', q);
    if (blob.size <= p.budget || q <= 0.2) break;
    q -= 0.08;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, w, h, mime: blob.type, url: URL.createObjectURL(blob) };
}

export function detectMime(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  return 'application/octet-stream';
}

/** Grayscale, auto-contrast and Floyd–Steinberg dithering to 1 bit. Format: [w, h, packed bits...] */
export function ditherForVibe(img, size) {
  const [w, h] = fit(img.naturalWidth, img.naturalHeight, size);
  const c = draw(img, w, h);
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const sorted = Array.from(g).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.03)];
  const hi = sorted[Math.floor(sorted.length * 0.97)];
  for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, ((g[i] - lo) / Math.max(1, hi - lo)) * 255));
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = g[i] >= 128 ? 255 : 0;
      bits[i] = v ? 1 : 0;
      const err = g[i] - v;
      if (x + 1 < w) g[i + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) g[i + w - 1] += (err * 3) / 16;
        g[i + w] += (err * 5) / 16;
        if (x + 1 < w) g[i + w + 1] += err / 16;
      }
    }
  const bytes = new Uint8Array(2 + Math.ceil((w * h) / 8));
  bytes[0] = w;
  bytes[1] = h;
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[2 + (i >> 3)] |= 0x80 >> (i & 7);
  return { bytes, w, h };
}

/**
 * Paint a 1-bit picture into a canvas. `known(byteIndex)` says whether that byte has arrived;
 * unknown pixels are drawn as a hatch so the picture can be shown while it is still arriving.
 */
export function paintBits(canvas, bytes, known = () => true, ink = '#111', paper = '#f4efe6', unknown = '#c9c1b4') {
  const w = bytes[0];
  const h = bytes[1];
  if (!w || !h || w > 64 || h > 64) return false;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const bi = 2 + (i >> 3);
      if (!known(bi)) ctx.fillStyle = (x + y) % 2 ? unknown : paper;
      else ctx.fillStyle = bytes[bi] & (0x80 >> (i & 7)) ? paper : ink;
      ctx.fillRect(x, y, 1, 1);
    }
  return true;
}
