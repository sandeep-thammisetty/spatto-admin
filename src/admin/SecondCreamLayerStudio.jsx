import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { getCreamGrainNormalMap } from '../lib/creamWaveTexture.js';
import {
  buildSecondCreamLayer,
  sampleProfile,
  flatProfile,
  SECOND_CREAM_DEFAULTS,
  SECOND_CREAM_PRESETS,
} from '../lib/secondCreamLayer.js';

// Scene constants mirror the designer's bottom tier (see ChocolateDripStudio / PerchCalibrator) so the
// finish is tuned at the exact scale customers see: radius 1.2, wall from BOARD_H up by BOTTOM_H.
const R = 1.2, BOTTOM_H = 1.45, BOARD_H = 0.1, BOARD_R = 1.6;
const Y0 = BOARD_H;                 // bottom of the cake wall
const PROFILE_N = SECOND_CREAM_DEFAULTS.profileLen;
const BRUSH = 3;                    // ± angular samples feathered per paint sample

// White buttercream wall + board, with the shared cream micro-grain so it reads as cream, not plastic.
function CakeMesh({ cakeColor }) {
  const grain = useMemo(() => {
    const t = getCreamGrainNormalMap();
    const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(8, 8); c.needsUpdate = true;
    return c;
  }, []);
  return (
    <group>
      <mesh position={[0, BOARD_H / 2, 0]}>
        <cylinderGeometry args={[BOARD_R, BOARD_R, BOARD_H, 72]} />
        <meshStandardMaterial color="#d9b44a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, BOARD_H + BOTTOM_H / 2, 0]}>
        <cylinderGeometry args={[R, R, BOTTOM_H, 96, 1]} />
        <meshStandardMaterial color={cakeColor} roughness={0.9} metalness={0} normalMap={grain} normalScale={new THREE.Vector2(0.3, 0.3)} />
      </mesh>
    </group>
  );
}

// The raised second cream skin, rebuilt from the authored edge profile.
function SecondCream({ edge, color, lift, noise, seed, fillSide }) {
  const geo = useMemo(
    () => buildSecondCreamLayer({ R, y0: Y0, wallH: BOTTOM_H, lift, edge, noise, seed, fillSide }),
    [edge, lift, noise, seed, fillSide],
  );
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.85, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.4,
    side: THREE.DoubleSide, envMapIntensity: 0.9,
  }), []);
  mat.color.set(color);
  return <mesh geometry={geo} material={mat} />;
}

// Invisible full-wall cylinder that captures pointer events for painting. It sits a hair outside the
// proud band so a raycast always lands on it (and its hit y maps directly to a band height).
function PaintTarget({ enabled, onPaint }) {
  const painting = useRef(false);
  function paint(e) {
    e.stopPropagation();
    onPaint(e.point.clone(), e.eventObject);   // world point → handler converts to local (θ, height)
  }
  return (
    <mesh
      position={[0, Y0 + BOTTOM_H / 2, 0]}
      onPointerDown={enabled ? (e) => { painting.current = true; e.target.setPointerCapture?.(e.pointerId); paint(e); } : undefined}
      onPointerMove={enabled ? (e) => { if (painting.current) paint(e); } : undefined}
      onPointerUp={enabled ? (e) => { painting.current = false; e.target.releasePointerCapture?.(e.pointerId); } : undefined}
    >
      {/* Rendered but invisible (no colour/depth write) so it always raycasts as the paint canvas. */}
      <cylinderGeometry args={[R + 0.2, R + 0.2, BOTTOM_H, 96, 1, true]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Spins the cake group so the customer can "scrape" the torn edge all the way around while it rotates
// (the real turntable motion). Independent of OrbitControls so painting keeps working as it spins.
function Spinner({ enabled, groupRef }) {
  useFrame((_, dt) => {
    if (enabled && groupRef.current) groupRef.current.rotation.y += Math.min(dt, 0.05) * 0.5;
  });
  return null;
}

function Scene({ groupRef, autoRotate, paintMode, edge, setEdge, color, cakeColor, lift, noise, seed, fillSide }) {
  // World hit point → local (θ, height) on the cake, accounting for the group's current spin.
  function paintAt(worldPoint) {
    const lp = groupRef.current.worldToLocal(worldPoint.clone());
    let a = Math.atan2(lp.z, lp.x);
    if (a < 0) a += Math.PI * 2;
    const idx = Math.round((a / (Math.PI * 2)) * PROFILE_N) % PROFILE_N;
    const frac = Math.max(0, Math.min(1, (lp.y - Y0) / BOTTOM_H));
    setEdge((prev) => {
      const next = prev.slice();
      for (let d = -BRUSH; d <= BRUSH; d++) {
        const j = ((idx + d) % PROFILE_N + PROFILE_N) % PROFILE_N;
        const w = 1 - Math.abs(d) / (BRUSH + 1);   // soft brush so painting stays smooth
        next[j] = next[j] * (1 - w) + frac * w;
      }
      return next;
    });
  }

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={1.3} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} />
      <Environment preset="studio" />
      <group ref={groupRef}>
        <CakeMesh cakeColor={cakeColor} />
        <SecondCream edge={edge} color={color} lift={lift} noise={noise} seed={seed} fillSide={fillSide} />
        <PaintTarget enabled={paintMode} onPaint={paintAt} />
      </group>
      <Spinner enabled={autoRotate} groupRef={groupRef} />
      <OrbitControls target={[0, 1.2, 0]} makeDefault enablePan enableRotate={!paintMode} />
    </>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#EDEAE2', fontFamily: 'Quicksand, sans-serif', padding: '28px 24px' },
  title: { fontSize: 22, fontWeight: 800, color: '#2C4433' },
  sub: { fontSize: 13, color: '#7A8F80', marginBottom: 18 },
  layout: { display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 20, maxWidth: 1300, alignItems: 'start' },
  card: { background: '#fff', borderRadius: 18, border: '1.5px solid #C5D4C8', padding: 22 },
  label: { fontSize: 11, fontWeight: 800, color: '#3D5A44', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' },
  row: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  rowLabel: { fontSize: 12, fontWeight: 700, color: '#3D5A44', minWidth: 86 },
  val: { fontSize: 12, fontWeight: 700, color: '#2C4433', minWidth: 46, textAlign: 'right' },
  btn: { marginTop: 12, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#3D5A44', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' },
  ghost: { marginTop: 8, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #C5D4C8', background: '#fff', color: '#3D5A44', fontFamily: 'Quicksand, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' },
  hint: { fontSize: 11, color: '#9BB5A2', marginTop: 6, lineHeight: 1.5 },
  swatchRow: { display: 'flex', gap: 8, marginBottom: 8 },
  colorInput: { width: 44, height: 32, padding: 0, border: '1.5px solid #C5D4C8', borderRadius: 8, background: '#fff', cursor: 'pointer' },
  seg: { display: 'flex', gap: 6, marginBottom: 8 },
};

function Slider({ label, value, min, max, step, onChange, fmt = v => v }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} style={{ flex: 1, accentColor: '#3D5A44' }} />
      <span style={S.val}>{fmt(value)}</span>
    </div>
  );
}

function SegBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
      border: active ? '2px solid #3D5A44' : '1.5px solid #C5D4C8',
      background: active ? '#EEF4EF' : '#fff', color: '#2C4433',
      fontFamily: 'Quicksand, sans-serif', fontSize: 12, fontWeight: 700,
    }}>{children}</button>
  );
}

const PINK_PRESETS = ['#e8a0b4', '#d96a86', '#b23a55', '#7a1f33', '#c98a3a'];

export default function SecondCreamLayerStudio() {
  const [edge, setEdge]         = useState(() => SECOND_CREAM_PRESETS['Gentle wave']());
  const [color, setColor]       = useState('#d96a86');
  const [cakeColor, setCakeColor] = useState('#f4efe9');
  const [lift, setLift]         = useState(SECOND_CREAM_DEFAULTS.lift);
  const [noise, setNoise]       = useState(SECOND_CREAM_DEFAULTS.noise);
  const [seed, setSeed]         = useState(1);
  const [fillSide, setFillSide] = useState(SECOND_CREAM_DEFAULTS.fillSide);
  const [mode, setMode]         = useState('orbit');   // 'orbit' | 'paint'
  const [autoRotate, setAutoRotate] = useState(false);

  const groupRef = useRef(null);

  function smooth() {
    setEdge((prev) => {
      const n = prev.length;
      return prev.map((_, i) => {
        const a = prev[(i - 1 + n) % n], b = prev[i], c = prev[(i + 1) % n];
        return (a + 2 * b + c) / 4;
      });
    });
  }

  function copyJson() {
    // Tuned engine defaults (not the per-customer edge, which is authored at runtime in the designer).
    const json = { second_cream: { lift: +lift.toFixed(3), noise: +noise.toFixed(3), fill_side: fillSide } };
    navigator.clipboard?.writeText(JSON.stringify(json, null, 2));
  }

  return (
    <div style={S.page}>
      <div style={S.title}>Second Cream Layer Studio</div>
      <div style={S.sub}>
        A raised second buttercream band with an irregular torn edge. Switch to Paint, turn on Auto-rotate, and
        scrape the edge as the cake spins. Prototype — ports to core as a tier finish.
      </div>
      <div style={S.layout}>
        <div style={S.card}>
          <label style={S.label}>Mode</label>
          <div style={S.seg}>
            <SegBtn active={mode === 'orbit'} onClick={() => setMode('orbit')}>Orbit</SegBtn>
            <SegBtn active={mode === 'paint'} onClick={() => setMode('paint')}>Paint edge</SegBtn>
          </div>
          <div style={S.row}>
            <span style={{ ...S.rowLabel, minWidth: 0 }}>Auto-rotate</span>
            <input type="checkbox" checked={autoRotate} onChange={e => setAutoRotate(e.target.checked)} style={{ accentColor: '#3D5A44', width: 18, height: 18 }} />
            <div style={{ flex: 1 }} />
          </div>
          <div style={S.hint}>
            {mode === 'paint'
              ? 'Drag on the cake to set how high the colour reaches at that angle. Auto-rotate brings the back around.'
              : 'Drag to orbit the camera. Switch to Paint to draw the torn edge.'}
          </div>

          <label style={{ ...S.label, marginTop: 16 }}>Second colour</label>
          <div style={S.swatchRow}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={S.colorInput} />
            {PINK_PRESETS.map(c => (
              <button key={c} onClick={() => setColor(c)} title={c}
                style={{ width: 28, height: 32, border: color === c ? '2px solid #3D5A44' : '1.5px solid #C5D4C8', borderRadius: 8, background: c, cursor: 'pointer' }} />
            ))}
          </div>

          <label style={{ ...S.label, marginTop: 14 }}>Fill</label>
          <div style={S.seg}>
            <SegBtn active={fillSide === 'below'} onClick={() => setFillSide('below')}>Below line</SegBtn>
            <SegBtn active={fillSide === 'above'} onClick={() => setFillSide('above')}>Above line</SegBtn>
          </div>

          <div style={{ marginTop: 14 }}>
            <Slider label="Lift"  value={lift}  min={0}    max={0.12} step={0.005} onChange={setLift}  fmt={v => v.toFixed(3)} />
            <Slider label="Torn"  value={noise} min={0}    max={0.18} step={0.005} onChange={setNoise} fmt={v => v.toFixed(3)} />
          </div>

          <label style={{ ...S.label, marginTop: 14 }}>Edge presets</label>
          <div style={S.seg}>
            {Object.keys(SECOND_CREAM_PRESETS).map(name => (
              <SegBtn key={name} active={false} onClick={() => setEdge(SECOND_CREAM_PRESETS[name]())}>{name}</SegBtn>
            ))}
          </div>

          <button style={S.ghost} onClick={smooth}>Smooth edge</button>
          <button style={S.ghost} onClick={() => setEdge(flatProfile())}>Reset edge</button>
          <button style={S.ghost} onClick={() => setSeed(s => s + 1)}>Reroll tear</button>

          <div style={S.row}>
            <span style={{ ...S.rowLabel, minWidth: 0 }}>Base cake</span>
            <input type="color" value={cakeColor} onChange={e => setCakeColor(e.target.value)} style={{ ...S.colorInput, width: 32 }} />
          </div>

          <button style={S.ghost} onClick={copyJson}>Copy JSON</button>
          <div style={S.hint}>
            Look-tuning only — no DB. The torn edge is authored by the customer in the designer at runtime; this studio
            tunes the engine (lift / torn / fill) and the raised-lip look before porting to core.
          </div>
        </div>

        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 600, background: '#E8EDE9', cursor: mode === 'paint' ? 'crosshair' : 'grab' }}>
            <Canvas gl={{ preserveDrawingBuffer: true, alpha: true }} camera={{ position: [0, 1.9, 5], fov: 40 }}>
              <Scene
                groupRef={groupRef}
                autoRotate={autoRotate}
                paintMode={mode === 'paint'}
                edge={edge} setEdge={setEdge}
                color={color} cakeColor={cakeColor}
                lift={lift} noise={noise} seed={seed} fillSide={fillSide}
              />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
}
