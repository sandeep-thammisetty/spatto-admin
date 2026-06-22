import React, { useEffect, useRef, useState } from 'react';
import { fetchElementTypes, getSignedUploadUrl, uploadToR2, createGlobalElement } from '../lib/api.js';

// ── Photo Frame Studio ─────────────────────────────────────────────────────────
// A guided authoring screen for "photo cake" frame elements. A frame is ONE cake_elements
// row that carries TWO images: the OVERLAY (image_url — the printed border with a transparent
// window) and the MASK (placement_config.photo.mask — the window silhouette). Both upload through
// the same signed-URL flow as every other element; the mask is just a second R2 key on the same
// row's config (no second element, no join). The thumbnail is a live composite of overlay + mask +
// a sample photo so the picker tile reads as a framed photo. Reuses createGlobalElement and the
// upload helpers — not a parallel element-creation path.

const FRAME_PLACEMENT = { top_surface: 'hug', side: 'hug' };
const FRAME_ZONES = ['top_surface', 'side'];
const FRAME_ACTIONS = { resize: true, duplicate: true, color: false, gradient: false, delete: true, move: false, tilt: false };

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// Cover-fit a source image into an S×S square (fill, crop overflow, never distort).
function drawCover(ctx, img, S) {
  const ar = (img.width || 1) / (img.height || 1);
  let dw, dh;
  if (ar >= 1) { dh = S; dw = S * ar; } else { dw = S; dh = S / ar; }
  ctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
}

// Draw the framed-photo composite into a fresh S×S canvas: photo (cover) → clipped to the mask's
// alpha (destination-in) → overlay border on top. Mirrors how the designer renders a photo frame.
function composite(S, photoImg, maskImg, overlayImg) {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  if (photoImg) {
    drawCover(ctx, photoImg, S);
  } else {
    // Generated stand-in "photo" so the tile still reads as a framed photo.
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#bcd3e6'); g.addColorStop(1, '#f2d9c4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(S * 0.5, S * 0.42, S * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.86, S * 0.30, S * 0.22, 0, Math.PI, 0); ctx.fill();
  }
  if (maskImg) { ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(maskImg, 0, 0, S, S); }
  ctx.globalCompositeOperation = 'source-over';
  if (overlayImg) ctx.drawImage(overlayImg, 0, 0, S, S);
  return c;
}

function Drop({ label, hint, accept, file, onChange }) {
  return (
    <label style={s.fileBox}>
      <input type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onChange(f); }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2C4433' }}>{file ? file.name : label}</div>
      {hint && <div style={{ fontSize: 11, color: '#6B8C74', marginTop: 2 }}>{hint}</div>}
    </label>
  );
}

export default function PhotoFrameStudio() {
  const [elementTypes, setElementTypes] = useState([]);
  const [name, setName]                 = useState('');
  const [elementTypeId, setTypeId]      = useState('');
  const [overlayFile, setOverlayFile]   = useState(null);
  const [maskFile, setMaskFile]         = useState(null);
  const [sampleFile, setSampleFile]     = useState(null);
  const [overlayImg, setOverlayImg]     = useState(null);
  const [maskImg, setMaskImg]           = useState(null);
  const [sampleImg, setSampleImg]       = useState(null);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState(null);
  const previewRef = useRef(null);

  useEffect(() => { fetchElementTypes().then(setElementTypes).catch(() => setElementTypes([])); }, []);

  useEffect(() => { if (overlayFile) loadImage(overlayFile).then(setOverlayImg).catch(() => setOverlayImg(null)); else setOverlayImg(null); }, [overlayFile]);
  useEffect(() => { if (maskFile)    loadImage(maskFile).then(setMaskImg).catch(() => setMaskImg(null));       else setMaskImg(null); }, [maskFile]);
  useEffect(() => { if (sampleFile)  loadImage(sampleFile).then(setSampleImg).catch(() => setSampleImg(null)); else setSampleImg(null); }, [sampleFile]);

  // Live preview — redraw whenever any layer changes.
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const S = cv.width;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    // checkerboard so the transparent areas (outside the frame) are visible
    const t = 16;
    for (let y = 0; y < S; y += t) for (let x = 0; x < S; x += t) {
      ctx.fillStyle = ((x / t + y / t) % 2 === 0) ? '#eceff1' : '#dfe4e7';
      ctx.fillRect(x, y, t, t);
    }
    if (overlayImg || maskImg) ctx.drawImage(composite(S, sampleImg, maskImg, overlayImg), 0, 0);
  }, [overlayImg, maskImg, sampleImg]);

  async function uploadOne(folder, file, contentType) {
    const ext = (file.name?.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const filename = `${crypto.randomUUID()}.${ext}`;
    const { url, key } = await getSignedUploadUrl(folder, filename, contentType);
    await uploadToR2(url, file);
    return key;
  }

  async function handleSave() {
    if (!name.trim())     { setMsg({ ok: false, text: 'Name is required.' }); return; }
    if (!elementTypeId)   { setMsg({ ok: false, text: 'Pick an element type.' }); return; }
    if (!overlayFile)     { setMsg({ ok: false, text: 'Upload the frame overlay image.' }); return; }
    if (!maskFile)        { setMsg({ ok: false, text: 'Upload the window mask image.' }); return; }
    setSaving(true); setMsg(null);
    try {
      // Overlay + mask uploaded untouched (their alpha is authored and must stay aligned).
      const overlayKey = await uploadOne('elements/files/2D', overlayFile, overlayFile.type || 'image/png');
      const maskKey    = await uploadOne('elements/files/2D', maskFile, maskFile.type || 'image/png');
      // Thumbnail = the composite (overlay + sample photo), so the picker tile reads as a framed photo.
      const thumbBlob = await new Promise(res => composite(512, sampleImg, maskImg, overlayImg).toBlob(res, 'image/png'));
      const thumbKey  = await uploadOne('elements/thumbnails', new File([thumbBlob], 'thumb.png', { type: 'image/png' }), 'image/png');

      await createGlobalElement({
        name:             name.trim(),
        description:      null,
        element_type_id:  elementTypeId,
        parent_id:        null,
        image_url:        overlayKey,
        thumbnail_url:    thumbKey,
        file_size:        overlayFile.size ?? null,
        allowed_zones:    FRAME_ZONES,
        placement_config: { ...FRAME_PLACEMENT, photo: { mask: maskKey } },
        allowed_actions:  FRAME_ACTIONS,
        default_color:    null,
        sort_order:       0,
      });

      setMsg({ ok: true, text: 'Photo frame element saved!' });
      setName(''); setOverlayFile(null); setMaskFile(null); setSampleFile(null);
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Photo Frame Studio</h1>
      <p style={s.sub}>
        Author a "photo cake" frame in one element. Upload the <b>frame overlay</b> (border art with a
        transparent window) and the <b>window mask</b> (white window silhouette). Both align to the same
        square. The customer uploads their photo in the designer; it shows through the window.
      </p>

      <div style={s.grid}>
        <div style={s.col}>
          <label style={s.label}>Name</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Heart Photo Frame" />

          <label style={s.label}>Element type</label>
          <select style={s.select} value={elementTypeId} onChange={e => setTypeId(e.target.value)}>
            <option value="">Select type…</option>
            {elementTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <Drop label="Frame overlay (PNG: border + transparent window)" hint="The printed frame. image_url" accept="image/*" file={overlayFile} onChange={setOverlayFile} />
          <Drop label="Window mask (PNG: white window on transparent)" hint="The window shape. placement_config.photo.mask" accept="image/png" file={maskFile} onChange={setMaskFile} />
          <Drop label="Sample photo (optional — for the thumbnail)" hint="Shown behind the frame in the preview/tile. A placeholder is used if omitted." accept="image/*" file={sampleFile} onChange={setSampleFile} />

          <div style={s.infoBox}>
            Auto-config: placed on <b>Top + Side</b>, lies flat (<b>hug</b>), resizable, one photo per placed frame.
            Each frame the customer drops carries its own uploaded photo.
          </div>

          <button style={{ ...s.btn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save photo frame element'}
          </button>
          {msg && <div style={{ ...s.msg, color: msg.ok ? '#2e7d32' : '#c0392b' }}>{msg.text}</div>}
        </div>

        <div style={s.col}>
          <label style={s.label}>Live preview</label>
          <canvas ref={previewRef} width={420} height={420} style={s.canvas} />
          <div style={{ fontSize: 11, color: '#6B8C74', marginTop: 6 }}>
            Photo clipped to the window, overlay border on top. The checkerboard is transparent area
            (the cake shows there). If the photo spills past the border, the mask is larger than the
            overlay's window — shrink the mask.
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:   { maxWidth: 960, margin: '0 auto', padding: '24px 20px 64px', fontFamily: "'Quicksand', sans-serif" },
  h1:     { fontSize: 22, fontWeight: 800, color: '#2C4433', margin: '0 0 6px' },
  sub:    { fontSize: 13, color: '#5C7565', lineHeight: 1.6, margin: '0 0 20px' },
  grid:   { display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' },
  col:    { flex: '1 1 360px', minWidth: 320, display: 'flex', flexDirection: 'column' },
  label:  { fontSize: 12, fontWeight: 700, color: '#2C4433', margin: '12px 0 4px' },
  input:  { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #C5D4C8', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  select: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #C5D4C8', fontSize: 13, fontFamily: 'inherit', background: '#fff' },
  fileBox:{ display: 'block', marginTop: 8, padding: '12px 14px', borderRadius: 10, border: '1.5px dashed #C5D4C8', background: '#F7FAF8', cursor: 'pointer' },
  infoBox:{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: '#EEF5F0', border: '1px solid #D6E3DA', fontSize: 12, color: '#3D5A44', lineHeight: 1.5 },
  btn:    { marginTop: 16, padding: '11px 16px', borderRadius: 10, border: 'none', background: '#3D5A44', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  msg:    { marginTop: 10, fontSize: 13, fontWeight: 700 },
  canvas: { width: 420, height: 420, maxWidth: '100%', borderRadius: 12, border: '1.5px solid #C5D4C8', background: '#fff' },
};
