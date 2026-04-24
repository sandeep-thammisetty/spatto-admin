import { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { fetchElementTypes, fetchParentElements, getSignedUploadUrl, uploadToR2, createGlobalElement } from '../lib/api.js';

const ASSET_TYPES = [
  { value: '2D', label: '2D Image',       folder: 'elements/files/2D' },
  { value: '3D', label: '3D Model (GLB)', folder: 'elements/files/3D' },
];

const s = {
  page: {
    minHeight: '100vh', background: '#EDEAE2',
    fontFamily: "'Quicksand', sans-serif", padding: '40px 0',
    display: 'flex', justifyContent: 'center',
  },
  card: {
    background: '#fff', borderRadius: 16,
    border: '1.5px solid #C5D4C8',
    padding: 32, width: '100%', maxWidth: 520,
    alignSelf: 'flex-start',
  },
  title:  { fontSize: 20, fontWeight: 800, color: '#2C4433', marginBottom: 28 },
  field:  { marginBottom: 20 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#3D5A44', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '9px 12px', border: '1.5px solid #C5D4C8', borderRadius: 8,
    fontSize: 13, fontFamily: "'Quicksand', sans-serif", color: '#2C4433',
    outline: 'none', boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '8px 10px', border: '1.5px solid #C5D4C8', borderRadius: 8,
    fontSize: 13, fontFamily: "'Quicksand', sans-serif", color: '#2C4433',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  },
  checkRow:  { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  checkbox:  { width: 18, height: 18, accentColor: '#3D5A44', cursor: 'pointer' },
  checkLabel:{ fontSize: 13, fontWeight: 700, color: '#2C4433' },
  radioRow:  { display: 'flex', gap: 12 },
  radioBtn: (active) => ({
    flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
    border: `1.5px solid ${active ? '#3D5A44' : '#C5D4C8'}`,
    background: active ? '#E8EDE9' : '#fff',
    color: active ? '#2C4433' : '#6B8C74',
    fontSize: 13, fontWeight: 700, fontFamily: "'Quicksand', sans-serif",
  }),
  fileBox: {
    width: '100%', padding: '28px 16px', border: '1.5px dashed #C5D4C8', borderRadius: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: '#f7f9f7', cursor: 'pointer', boxSizing: 'border-box',
  },
  fileName:   { fontSize: 12, color: '#3D5A44', marginTop: 6, fontWeight: 600 },
  previewBox: {
    width: '100%', height: 220, borderRadius: 10, overflow: 'hidden',
    border: '1.5px solid #C5D4C8', marginBottom: 8, background: '#f7f9f7',
  },
  thumbPreview: {
    width: '100%', height: 120, borderRadius: 10, overflow: 'hidden',
    border: '1.5px solid #C5D4C8', marginBottom: 8, background: '#f7f9f7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btn: (variant = 'primary') => ({
    width: '100%', padding: '11px 0', borderRadius: 10,
    cursor: 'pointer', border: 'none', fontSize: 14, fontWeight: 700,
    fontFamily: "'Quicksand', sans-serif",
    background: variant === 'primary' ? '#3D5A44' : '#E8EDE9',
    color: variant === 'primary' ? '#fff' : '#3D5A44',
  }),
  smallBtn: {
    padding: '7px 14px', borderRadius: 8, cursor: 'pointer', border: 'none',
    fontSize: 12, fontWeight: 700, fontFamily: "'Quicksand', sans-serif",
    background: '#E8EDE9', color: '#3D5A44', marginBottom: 12,
  },
  msg: (ok) => ({
    fontSize: 13, fontWeight: 600, textAlign: 'center',
    color: ok ? '#3D5A44' : '#c00', marginTop: 12,
  }),
};

function FileDropZone({ label, accept, file, onChange }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <label style={s.fileBox}>
        <input type="file" accept={accept} style={{ display: 'none' }} onChange={e => onChange(e.target.files[0])} />
        <span style={{ fontSize: 12, color: '#6B8C74' }}>Click to choose file</span>
        {file && <span style={s.fileName}>{file.name}</span>}
      </label>
    </div>
  );
}

function GLBModel({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function GLBPreview({ file, canvasRef }) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div style={s.previewBox} ref={canvasRef}>
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [0, 1, 3], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Suspense fallback={null}>
          {objectUrl && <GLBModel url={objectUrl} />}
        </Suspense>
        <OrbitControls autoRotate autoRotateSpeed={2} />
      </Canvas>
    </div>
  );
}

export default function AddElement() {
  const [elementTypes, setElementTypes]   = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [name, setName]                   = useState('');
  const [elementTypeId, setElementTypeId] = useState('');
  const [isParent, setIsParent]           = useState(false);
  const [parentId, setParentId]           = useState('');
  const [assetType, setAssetType]         = useState('2D');
  const [assetFile, setAssetFile]         = useState(null);
  const [thumbnailBlob, setThumbnailBlob] = useState(null);
  const [saving, setSaving]               = useState(false);
  const [msg, setMsg]                     = useState(null);
  const canvasRef                         = useRef();

  useEffect(() => {
    fetchElementTypes()
      .then(setElementTypes)
      .catch(err => setMsg({ ok: false, text: err.message }));
  }, []);

  useEffect(() => {
    if (!elementTypeId || isParent) { setParentOptions([]); setParentId(''); return; }
    fetchParentElements(elementTypeId)
      .then(setParentOptions)
      .catch(() => setParentOptions([]));
  }, [elementTypeId, isParent]);

  // For 2D, use the asset file itself as thumbnail
  useEffect(() => {
    if (assetType === '2D' && assetFile) setThumbnailBlob(assetFile);
    else setThumbnailBlob(null);
  }, [assetFile, assetType]);

  function handleIsParentToggle() {
    setIsParent(p => !p);
    setParentId('');
  }

  function captureThumbnail() {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob(blob => setThumbnailBlob(blob), 'image/png');
  }

  async function handleSave() {
    if (!name.trim() || !elementTypeId || !assetFile) {
      setMsg({ ok: false, text: 'Name, element type and asset file are required.' });
      return;
    }
    if (!isParent && !parentId) {
      setMsg({ ok: false, text: 'Select a parent element or check "Is Parent".' });
      return;
    }
    if (assetType === '3D' && !thumbnailBlob) {
      setMsg({ ok: false, text: 'Capture a thumbnail before saving.' });
      return;
    }
    setSaving(true);
    setMsg(null);

    try {
      const folder = ASSET_TYPES.find(a => a.value === assetType).folder;
      const ext = assetFile.name.split('.').pop();
      const assetFilename = `${crypto.randomUUID()}.${ext}`;

      const { url: assetUrl, key: assetKey } = await getSignedUploadUrl(folder, assetFilename, assetFile.type);
      await uploadToR2(assetUrl, assetFile);

      // Upload thumbnail (2D: same file; 3D: captured blob)
      const thumbFilename = `${crypto.randomUUID()}.png`;
      const thumbContentType = assetType === '2D' ? assetFile.type : 'image/png';
      const { url: thumbUrl, key: thumbKey } = await getSignedUploadUrl('elements/thumbnails', thumbFilename, thumbContentType);
      await uploadToR2(thumbUrl, thumbnailBlob);

      await createGlobalElement({
        name:            name.trim(),
        element_type_id: elementTypeId,
        parent_id:       isParent ? null : parentId,
        image_url:       assetKey,
        thumbnail_url:   thumbKey,
        sort_order:      0,
      });

      setMsg({ ok: true, text: 'Element saved!' });
      setName('');
      setElementTypeId('');
      setIsParent(false);
      setParentId('');
      setAssetFile(null);
      setThumbnailBlob(null);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.title}>Add Element</div>

          <div style={s.field}>
            <label style={s.label}>Name</label>
            <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rainbow Topper" />
          </div>

          <div style={s.field}>
            <label style={s.label}>Element Type</label>
            <select style={s.select} value={elementTypeId} onChange={e => { setElementTypeId(e.target.value); setParentId(''); }}>
              <option value="">Select type…</option>
              {elementTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div style={s.field}>
            <label style={s.checkRow}>
              <input type="checkbox" style={s.checkbox} checked={isParent} onChange={handleIsParentToggle} />
              <span style={s.checkLabel}>Is Parent</span>
            </label>
          </div>

          {!isParent && elementTypeId && (
            <div style={s.field}>
              <label style={s.label}>Parent Element</label>
              <select style={s.select} value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">Select parent…</option>
                {parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Asset Type</label>
            <div style={s.radioRow}>
              {ASSET_TYPES.map(a => (
                <button key={a.value} style={s.radioBtn(assetType === a.value)} onClick={() => { setAssetType(a.value); setAssetFile(null); setThumbnailBlob(null); }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <FileDropZone
            label={assetType === '3D' ? 'GLB File' : 'Image File'}
            accept={assetType === '3D' ? '.glb,.gltf' : 'image/*'}
            file={assetFile}
            onChange={setAssetFile}
          />

          {/* 3D preview + capture */}
          {assetType === '3D' && assetFile && (
            <div style={s.field}>
              <label style={s.label}>Preview</label>
              <GLBPreview file={assetFile} canvasRef={canvasRef} />
              <button style={s.smallBtn} onClick={captureThumbnail}>
                {thumbnailBlob ? 'Re-capture Thumbnail' : 'Capture Thumbnail'}
              </button>
              {thumbnailBlob && (
                <div style={{ fontSize: 11, color: '#3D5A44', fontWeight: 600 }}>Thumbnail captured</div>
              )}
            </div>
          )}

          {/* 2D preview */}
          {assetType === '2D' && assetFile && (
            <div style={s.field}>
              <label style={s.label}>Preview</label>
              <div style={s.thumbPreview}>
                <img
                  src={URL.createObjectURL(assetFile)}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  alt="preview"
                />
              </div>
            </div>
          )}

          <button
            style={{ ...s.btn('primary'), opacity: saving ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Element'}
          </button>

          {msg && <div style={s.msg(msg.ok)}>{msg.text}</div>}
        </div>
      </div>
    </>
  );
}
