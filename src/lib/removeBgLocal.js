// ── Client-side background removal (no remove.bg cost) ─────────────────────────
//
// Runs the SAME model rembg uses for its best general results — isnet-general-use (ISNet/DIS,
// Apache-2.0) — in the browser via onnxruntime-web. So the mask quality matches rembg on solid
// subjects (cake decorations). The model file is served same-origin from /models (gitignored, ~170 MB,
// browser-cached after first use). Zero per-image cost, zero server infra.
//
// rembg's optional pymatting "alpha matting" edge refinement isn't reproduced here (it matters only
// for hair/fuzz, which decorations don't have); instead we offer a light feather/threshold cleanup.
//
// Reusable: returns a PNG Blob, so any admin screen can swap the remote removeBg() for this later.

import * as ort from 'onnxruntime-web/webgpu';

// onnxruntime-web fetches its WASM/threading assets at runtime; point them at the matching CDN build
// so we don't have to bundle them. (WebGPU is tried first; WASM is the fallback.)
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

const MODEL_URL = '/models/isnet-general-use.onnx';
const SIZE = 1024;   // isnet-general-use input resolution

let _session = null;
let _loading = null;

// Lazily create (and cache) the inference session. `onProgress(0..1)` reports the model download.
export async function ensureSession(onProgress) {
  if (_session) return _session;
  if (_loading) return _loading;
  _loading = (async () => {
    const buf = await fetchWithProgress(MODEL_URL, onProgress);
    const session = await ort.InferenceSession.create(buf, {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
    });
    _session = session;
    return session;
  })();
  return _loading;
}

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`model fetch ${res.status} — is /models/isnet-general-use.onnx present?`);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total || !onProgress) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// Draw an image onto a square SIZE×SIZE canvas and build the normalized CHW tensor isnet expects:
// pixels/255, then (x − 0.5)/1.0 (rembg's isnet mean/std), channel-first, float32.
function preprocess(img) {
  const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const t = new Float32Array(3 * SIZE * SIZE);
  const plane = SIZE * SIZE;
  for (let i = 0; i < plane; i++) {
    t[i]             = (data[4 * i]     / 255 - 0.5);
    t[i + plane]     = (data[4 * i + 1] / 255 - 0.5);
    t[i + 2 * plane] = (data[4 * i + 2] / 255 - 0.5);
  }
  return new ort.Tensor('float32', t, [1, 3, SIZE, SIZE]);
}

// Min-max normalize the SIZE×SIZE mask logits to [0,1] (rembg does the same).
function normalizeMask(arr) {
  let mi = Infinity, ma = -Infinity;
  for (let i = 0; i < arr.length; i++) { if (arr[i] < mi) mi = arr[i]; if (arr[i] > ma) ma = arr[i]; }
  const range = (ma - mi) || 1e-6;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = (arr[i] - mi) / range;
  return out;
}

// Fill interior holes in the mask: flood-fill "background" (mask < t) inward from the image border;
// any low-mask pixel NOT reachable from the border is enclosed by the subject → set it to foreground.
// Recovers low-contrast interiors (e.g. white cake between red strokes) the model under-scores.
function fillHoles(mask, t) {
  const out = mask.slice();
  const seen = new Uint8Array(SIZE * SIZE);
  const stack = [];
  const push = (x, y) => { const i = y * SIZE + x; if (!seen[i] && mask[i] < t) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < SIZE; x++) { push(x, 0); push(x, SIZE - 1); }
  for (let y = 0; y < SIZE; y++) { push(0, y); push(SIZE - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % SIZE, y = (i / SIZE) | 0;
    if (x > 0) push(x - 1, y); if (x < SIZE - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < SIZE - 1) push(x, y + 1);
  }
  for (let i = 0; i < out.length; i++) if (mask[i] < t && !seen[i]) out[i] = 1;   // enclosed hole → fill
  return out;
}

// Bilinear sample of the SIZE×SIZE mask at normalized (u,v) ∈ [0,1].
function sampleMask(mask, u, v) {
  const fx = Math.min(SIZE - 1, Math.max(0, u * (SIZE - 1)));
  const fy = Math.min(SIZE - 1, Math.max(0, v * (SIZE - 1)));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(SIZE - 1, x0 + 1), y1 = Math.min(SIZE - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const a = mask[y0 * SIZE + x0], b = mask[y0 * SIZE + x1];
  const cc = mask[y1 * SIZE + x0], d = mask[y1 * SIZE + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
}

// Remove the background from an HTMLImageElement. Returns { blob, width, height } — an RGBA PNG with
// the subject kept and the background transparent. `threshold` hardens the cutout edge; `feather`
// softens it. Output keeps the source resolution.
export async function removeBackground(img, { threshold = 0.35, feather = 0.04, fillInteriorHoles = true, onProgress } = {}) {
  const session = await ensureSession(onProgress);
  const feeds = { [session.inputNames[0]]: preprocess(img) };
  const out = await session.run(feeds);
  const logits = out[session.outputNames[0]].data;          // [1,1,SIZE,SIZE]
  let mask = normalizeMask(logits.length > SIZE * SIZE ? logits.subarray(0, SIZE * SIZE) : logits);
  if (fillInteriorHoles) mask = fillHoles(mask, threshold);

  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const lo = Math.max(0, threshold - feather), hi = Math.min(1, threshold + feather);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = sampleMask(mask, x / (w - 1), y / (h - 1));
      // Soft alpha: smoothstep across the threshold band so edges aren't jagged.
      let a = hi > lo ? (m - lo) / (hi - lo) : (m >= threshold ? 1 : 0);
      a = a < 0 ? 0 : a > 1 ? 1 : a; a = a * a * (3 - 2 * a);
      id.data[4 * (y * w + x) + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(id, 0, 0);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  return { blob, width: w, height: h };
}
