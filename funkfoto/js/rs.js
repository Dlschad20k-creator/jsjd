// Reed-Solomon over GF(256) (primitive polynomial 0x11d), errors-only decoding.
// Corrects up to nsym/2 wrong bytes per codeword (codeword length <= 255).
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mod255 = (n) => ((n % 255) + 255) % 255;
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const gdiv = (a, b) => {
  if (!b) throw new Error('div0');
  return a ? EXP[mod255(LOG[a] - LOG[b])] : 0;
};
const gpow = (a, n) => EXP[mod255(LOG[a] * n)];
const ginv = (a) => EXP[255 - LOG[a]];

const pScale = (p, x) => p.map((v) => gmul(v, x));
function pAdd(p, q) {
  const r = new Array(Math.max(p.length, q.length)).fill(0);
  for (let i = 0; i < p.length; i++) r[i + r.length - p.length] = p[i];
  for (let i = 0; i < q.length; i++) r[i + r.length - q.length] ^= q[i];
  return r;
}
function pMul(p, q) {
  const r = new Array(p.length + q.length - 1).fill(0);
  for (let j = 0; j < q.length; j++) for (let i = 0; i < p.length; i++) r[i + j] ^= gmul(p[i], q[j]);
  return r;
}
function pEval(p, x) {
  let y = p[0];
  for (let i = 1; i < p.length; i++) y = gmul(y, x) ^ p[i];
  return y;
}
function pDiv(dividend, divisor) {
  const out = dividend.slice();
  for (let i = 0; i < dividend.length - (divisor.length - 1); i++) {
    const c = out[i];
    if (c) for (let j = 1; j < divisor.length; j++) if (divisor[j]) out[i + j] ^= gmul(divisor[j], c);
  }
  const sep = out.length - (divisor.length - 1);
  return [out.slice(0, sep), out.slice(sep)];
}

const genCache = new Map();
function generator(nsym) {
  if (genCache.has(nsym)) return genCache.get(nsym);
  let g = [1];
  for (let i = 0; i < nsym; i++) g = pMul(g, [1, gpow(2, i)]);
  genCache.set(nsym, g);
  return g;
}

/** @returns {Uint8Array} msg followed by nsym parity bytes */
export function rsEncode(msg, nsym) {
  const gen = generator(nsym);
  const res = new Array(msg.length + nsym).fill(0);
  for (let i = 0; i < msg.length; i++) res[i] = msg[i];
  for (let i = 0; i < msg.length; i++) {
    const c = res[i];
    if (c) for (let j = 1; j < gen.length; j++) res[i + j] ^= gmul(gen[j], c);
  }
  const out = new Uint8Array(msg.length + nsym);
  out.set(msg);
  out.set(res.slice(msg.length), msg.length);
  return out;
}

function syndromes(msg, nsym) {
  const s = new Array(nsym + 1).fill(0); // s[0] is a padding 0 (keeps the classic indexing)
  for (let i = 0; i < nsym; i++) s[i + 1] = pEval(msg, gpow(2, i));
  return s;
}

function errorLocator(synd, nsym) {
  let loc = [1];
  let old = [1];
  const shift = synd.length - nsym;
  for (let i = 0; i < nsym; i++) {
    const K = i + shift;
    let delta = synd[K];
    for (let j = 1; j < loc.length; j++) delta ^= gmul(loc[loc.length - 1 - j], synd[K - j]);
    old = old.concat([0]);
    if (delta) {
      if (old.length > loc.length) {
        const nl = pScale(old, delta);
        old = pScale(loc, ginv(delta));
        loc = nl;
      }
      loc = pAdd(loc, pScale(old, delta));
    }
  }
  while (loc.length && loc[0] === 0) loc.shift();
  if ((loc.length - 1) * 2 > nsym) return null;
  return loc;
}

function findErrors(locRev, n) {
  const errs = locRev.length - 1;
  const pos = [];
  for (let i = 0; i < n; i++) if (pEval(locRev, gpow(2, i)) === 0) pos.push(n - 1 - i);
  return pos.length === errs ? pos : null;
}

function correctErrata(msg, synd, errPos) {
  const coefPos = errPos.map((p) => msg.length - 1 - p);
  let eLoc = [1];
  for (const i of coefPos) eLoc = pMul(eLoc, pAdd([1], [gpow(2, i), 0]));
  const nsymE = eLoc.length - 1;
  const [, rem] = pDiv(pMul(synd.slice().reverse(), eLoc), [1].concat(new Array(nsymE + 1).fill(0)));
  const errEval = rem.reverse();
  const X = coefPos.map((c) => gpow(2, -(255 - c)));
  const E = new Array(msg.length).fill(0);
  for (let i = 0; i < X.length; i++) {
    const XiInv = ginv(X[i]);
    let prime = 1;
    for (let j = 0; j < X.length; j++) if (j !== i) prime = gmul(prime, 1 ^ gmul(XiInv, X[j]));
    if (!prime) return null;
    const y = gmul(X[i], pEval(errEval.slice().reverse(), XiInv));
    E[errPos[i]] = gdiv(y, prime);
  }
  return pAdd(msg, E);
}

/** Decode a codeword; returns {data, corrected} or null when uncorrectable. */
export function rsDecode(codeword, nsym) {
  const msg = Array.from(codeword);
  let synd = syndromes(msg, nsym);
  if (Math.max(...synd) === 0) return { data: Uint8Array.from(msg.slice(0, msg.length - nsym)), corrected: 0 };
  const loc = errorLocator(synd, nsym);
  if (!loc) return null;
  const pos = findErrors(loc.slice().reverse(), msg.length);
  if (!pos) return null;
  const fixed = correctErrata(msg, synd, pos);
  if (!fixed) return null;
  synd = syndromes(fixed, nsym);
  if (Math.max(...synd) !== 0) return null;
  return { data: Uint8Array.from(fixed.slice(0, fixed.length - nsym)), corrected: pos.length };
}
