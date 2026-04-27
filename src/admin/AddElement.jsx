import { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchElementTypes, fetchParentElements, getSignedUploadUrl, uploadToR2, createGlobalElement, removeBg } from '../lib/api.js';

const ASSET_TYPES = [
  { value: '2D', label: '2D Image',       folder: 'elements/files/2D' },
  { value: '3D', label: '3D Model (GLB)', folder: 'elements/files/3D' },
];

const CAKE_ZONES = [
  { value: 'top_surface',  label: 'Top Surface' },
  { value: 'side',         label: 'Side' },
  { value: 'middle_tier',  label: 'Middle Tier' },
  { value: 'board',        label: 'Board' },
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
    width: '100%', height: 380, borderRadius: 10, overflow: 'hidden',
    border: '1.5px solid #C5D4C8', marginBottom: 8, background: '#f7f9f7',
  },
  thumbPreview: {
    width: '100%', height: 120, borderRadius: 10, overflow: 'hidden',
    border: '1.5px solid #C5D4C8', marginBottom: 8,
    // Checkerboard so transparency shows clearly
    background: 'repeating-conic-gradient(#d0d8d2 0% 25%, #f7f9f7 0% 50%) 0 0 / 16px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spinner: {
    width: 22, height: 22, borderRadius: '50%',
    border: '3px solid #C5D4C8', borderTopColor: '#3D5A44',
    animation: 'spin 0.7s linear infinite',
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

function GLBModel({ url, color, onLoad, onTextureDetected }) {
  const { scene }  = useGLTF(url);
  const { camera, controls } = useThree();

  // Detect textures once on load, apply color to untextured meshes
  useEffect(() => {
    if (!scene) return;
    let hasAnyTexture = false;
    scene.traverse(obj => {
      if (!obj.isMesh) return;
      const mat = obj.material;
      if (mat && (mat.map || mat.normalMap || mat.roughnessMap)) {
        hasAnyTexture = true;
      }
    });
    onTextureDetected?.(hasAnyTexture);
  }, [scene]);

  useEffect(() => {
    if (!scene) return;
    scene.traverse(obj => {
      if (!obj.isMesh) return;
      const mat = obj.material;
      const hasTexture = mat && (mat.map || mat.normalMap || mat.roughnessMap);
      if (!hasTexture) {
        obj.material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 });
      }
    });
  }, [scene, color]);

  useEffect(() => {
    if (!scene) return;

    const box    = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist   = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.6;

    camera.position.set(center.x, center.y, center.z + dist);
    camera.near = dist / 100;
    camera.far  = dist * 100;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }

    const t = setTimeout(onLoad, 800);
    return () => clearTimeout(t);
  }, [scene]);

  return <primitive object={scene} />;
}

function GLBPreview({ file, color, canvasRef, onCapture, onTextureDetected }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [panMode, setPanMode]     = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const mouseButtons = panMode
    ? { LEFT: THREE.MOUSE.PAN,    RIGHT: THREE.MOUSE.ROTATE }
    : { LEFT: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };

  return (
    <div style={{ position: 'relative' }}>
      <div style={s.previewBox} ref={canvasRef}>
        <Canvas flat gl={{ preserveDrawingBuffer: true }} camera={{ position: [0, 1, 3], fov: 45 }}>
          <ambientLight intensity={1} />
          <directionalLight position={[2, 2, 2]} intensity={0.6} />
          <directionalLight position={[-2, 1, -2]} intensity={0.4} />
          <Suspense fallback={null}>
            {objectUrl && <GLBModel url={objectUrl} color={color} onLoad={onCapture} onTextureDetected={onTextureDetected} />}
          </Suspense>
          <OrbitControls enablePan makeDefault mouseButtons={mouseButtons} />
        </Canvas>
      </div>
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
        {['Rotate', 'Pan'].map(mode => (
          <button
            key={mode}
            onClick={() => setPanMode(mode === 'Pan')}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, fontFamily: "'Quicksand', sans-serif",
              background: (panMode ? 'Pan' : 'Rotate') === mode ? '#3D5A44' : '#E8EDE9',
              color:      (panMode ? 'Pan' : 'Rotate') === mode ? '#fff'     : '#3D5A44',
            }}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AddElement() {
  const [elementTypes, setElementTypes]   = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [name, setName]                   = useState('');
  const [elementTypeId, setElementTypeId] = useState('');
  const [applicableZones, setApplicableZones] = useState([]);
  const [isParent, setIsParent]           = useState(false);
  const [parentId, setParentId]           = useState('');
  const [assetType, setAssetType]         = useState('2D');
  const [elementColor, setElementColor]   = useState('#F0DEB8');
  const [glbHasTexture, setGlbHasTexture] = useState(null);
  const [assetFile, setAssetFile]         = useState(null);
  const [thumbnailBlob, setThumbnailBlob] = useState(null);
  const [saving, setSaving]               = useState(false);
  const [removingBg, setRemovingBg]       = useState(false);
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

  // For 2D, auto remove-bg from the asset file when selected
  useEffect(() => {
    if (assetType !== '2D' || !assetFile) { if (assetType === '2D') setThumbnailBlob(null); return; }
    processRemoveBg(assetFile);
  }, [assetFile, assetType]);

  function toggleZone(zone) {
    setApplicableZones(prev =>
      prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
    );
  }

  function handleIsParentToggle() {
    setIsParent(p => !p);
    setParentId('');
  }

  async function processRemoveBg(blob) {
    setRemovingBg(true);
    setThumbnailBlob(null);
    try {
      const processed = await removeBg(blob);
      setThumbnailBlob(processed);
    } catch {
      // Fall back to original if remove.bg fails
      setThumbnailBlob(blob);
    } finally {
      setRemovingBg(false);
    }
  }

  function captureThumbnail() {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob(blob => processRemoveBg(blob), 'image/png');
  }

  async function handleSave() {
    if (!name.trim() || !elementTypeId || !assetFile) {
      setMsg({ ok: false, text: 'Name, element type and asset file are required.' });
      return;
    }
    if (applicableZones.length === 0) {
      setMsg({ ok: false, text: 'Select at least one applicable zone.' });
      return;
    }
    if (!isParent && !parentId) {
      setMsg({ ok: false, text: 'Select a parent element or check "Is Parent".' });
      return;
    }
    if (assetType === '3D' && !thumbnailBlob) {
      setMsg({ ok: false, text: 'Thumbnail not ready yet — wait a moment for the preview to load.' });
      return;
    }
    setSaving(true);
    setMsg(null);

    try {
      const folder = ASSET_TYPES.find(a => a.value === assetType).folder;
      const ext = assetFile.name.split('.').pop();
      const assetFilename = `${crypto.randomUUID()}.${ext}`;

      const assetContentType = assetFile.type || (assetType === '3D' ? 'model/gltf-binary' : 'image/png');
      const { url: assetUrl, key: assetKey } = await getSignedUploadUrl(folder, assetFilename, assetContentType);
      await uploadToR2(assetUrl, assetFile);

      // Thumbnail is always PNG (remove.bg output)
      const thumbFilename = `${crypto.randomUUID()}.png`;
      const { url: thumbUrl, key: thumbKey } = await getSignedUploadUrl('elements/thumbnails', thumbFilename, 'image/png');
      await uploadToR2(thumbUrl, thumbnailBlob);

      await createGlobalElement({
        name:             name.trim(),
        element_type_id:  elementTypeId,
        parent_id:        isParent ? null : parentId,
        image_url:        assetKey,
        thumbnail_url:    thumbKey,
        allowed_zones:    applicableZones,
        default_color:    assetType === '3D' ? elementColor : null,
        sort_order:       0,
      });

      setMsg({ ok: true, text: 'Element saved!' });
      setName('');
      setElementTypeId('');
      setApplicableZones([]);
      setIsParent(false);
      setParentId('');
      setAssetFile(null);
      setElementColor('#F0DEB8');
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
            <label style={s.label}>Applicable Zones</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: 4 }}>
              {CAKE_ZONES.map(z => (
                <label key={z.value} style={s.checkRow}>
                  <input
                    type="checkbox"
                    style={s.checkbox}
                    checked={applicableZones.includes(z.value)}
                    onChange={() => toggleZone(z.value)}
                  />
                  <span style={s.checkLabel}>{z.label}</span>
                </label>
              ))}
            </div>
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
                <button key={a.value} style={s.radioBtn(assetType === a.value)} onClick={() => { setAssetType(a.value); setAssetFile(null); setThumbnailBlob(null); setGlbHasTexture(null); }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <FileDropZone
            label={assetType === '3D' ? 'GLB File' : 'Image File'}
            accept={assetType === '3D' ? '.glb,.gltf' : 'image/*'}
            file={assetFile}
            onChange={f => { setAssetFile(f); setGlbHasTexture(null); }}
          />

          {/* 3D preview + auto-capture */}
          {assetType === '3D' && assetFile && (
            <div style={s.field}>
              <label style={s.label}>3D Preview</label>
              {glbHasTexture === false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <label style={s.label} htmlFor="elColor">Element Color</label>
                  <input
                    id="elColor"
                    type="color"
                    value={elementColor}
                    onChange={e => setElementColor(e.target.value)}
                    style={{ width: 40, height: 32, border: '1.5px solid #C5D4C8', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                  />
                  <span style={{ fontSize: 12, color: '#6B8C74', fontWeight: 600 }}>{elementColor}</span>
                </div>
              )}
              <GLBPreview
                file={assetFile}
                color={glbHasTexture === false ? elementColor : undefined}
                canvasRef={canvasRef}
                onCapture={captureThumbnail}
                onTextureDetected={setGlbHasTexture}
              />
              <button style={s.smallBtn} onClick={captureThumbnail}>
                Re-capture Thumbnail
              </button>
            </div>
          )}

          {/* Thumbnail preview (both 2D and 3D) */}
          <div style={s.field}>
            <label style={s.label}>Thumbnail</label>
            {(removingBg || thumbnailBlob) && (
              <div style={s.thumbPreview}>
                {removingBg ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={s.spinner} />
                    <span style={{ fontSize: 11, color: '#6B8C74', fontWeight: 600 }}>Removing background…</span>
                  </div>
                ) : (
                  <img
                    src={URL.createObjectURL(thumbnailBlob)}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    alt="thumbnail"
                  />
                )}
              </div>
            )}
            <label style={{ ...s.fileBox, padding: '12px 16px', marginTop: 8 }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) setThumbnailBlob(e.target.files[0]); }}
              />
              <span style={{ fontSize: 12, color: '#6B8C74' }}>
                {thumbnailBlob ? 'Replace thumbnail…' : 'Upload custom thumbnail…'}
              </span>
            </label>
          </div>

          <button
            style={{ ...s.btn('primary'), opacity: (saving || removingBg) ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving || removingBg}
          >
            {saving ? 'Saving…' : removingBg ? 'Processing thumbnail…' : 'Save Element'}
          </button>

          {msg && <div style={s.msg(msg.ok)}>{msg.text}</div>}
        </div>
      </div>
    </>
  );
}
