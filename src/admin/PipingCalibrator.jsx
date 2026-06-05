import { useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const DEG = Math.PI / 180;

// Bend a flat ring into `swagCount` scalloped drapes (garland/swag look).
// MUST stay identical to buildSwagRing() in spattoo-core CakeTier.jsx so this
// preview matches the designer exactly. Shells are spaced by arc-length along the
// draped curve; tq pitches each about the world radial axis to follow the slope.
function buildSwagRing({ r, baseY, step, swagCount, swagDepth, swagTilt = 0.5 }) {
  const dipAt = a => -swagDepth * (1 - Math.cos(a * swagCount)) / 2;
  const N = 1440;
  const cum = [0];
  let px = r, py = baseY + dipAt(0), pz = 0;
  for (let s = 1; s <= N; s++) {
    const a = (s / N) * Math.PI * 2;
    const cx = Math.cos(a) * r, cy = baseY + dipAt(a), cz = Math.sin(a) * r;
    cum.push(cum[s - 1] + Math.hypot(cx - px, cy - py, cz - pz));
    px = cx; py = cy; pz = cz;
  }
  const total = cum[N];
  const count = Math.max(6, Math.round(total / step));
  const out = [];
  let seg = 0;
  for (let j = 0; j < count; j++) {
    const target = (j / count) * total;
    while (seg < N && cum[seg + 1] < target) seg++;
    const a0 = (seg / N) * Math.PI * 2, a1 = ((seg + 1) / N) * Math.PI * 2;
    const f  = (target - cum[seg]) / Math.max(1e-9, cum[seg + 1] - cum[seg]);
    const a  = a0 + (a1 - a0) * f;
    const slope = -(swagDepth * swagCount / 2) * Math.sin(a * swagCount);
    const tilt  = -swagTilt * Math.atan2(slope, r);
    const sh = Math.sin(tilt / 2), ch = Math.cos(tilt / 2);
    const tq = [Math.cos(a) * sh, 0, Math.sin(a) * sh, ch];
    out.push({ pos: [Math.cos(a) * r, baseY + dipAt(a), Math.sin(a) * r], rotY: a, tq });
  }
  return out;
}

// Match the designer's default cake so the calibrator is to scale.
const CAKE_RADIUS = 1.2;   // designer TIER_RADII[0]
const CAKE_HEIGHT = 1.45;  // designer BOTTOM_H
const Y_BASE      = 0.1;   // top of board (designer BOTTOM_BASE)
const SWAG_LIFT   = 0.55;  // attachment height the festoon hangs from when swag is first enabled

// ── Bend a straight strip GLB into U-shaped festoons (swags) on the cake wall ──
// One strip = one swag, its whole mesh bent into a U (belly hangs, ends attach high).
// Returns an array of bent geometries (one per festoon around the cake). The SAME
// math is mirrored in the designer (CakeTier.jsx) so the preview matches.
function bakeStrip(scene, flip) {
  scene.updateMatrixWorld(true);
  let src = null;
  // Bake the node transform into the geometry so we work in real (small) units, not
  // the GLB's raw local coords (which can be ~70× scaled & offset).
  scene.traverse(o => { if (o.isMesh && !src) { src = o.geometry.clone(); src.applyMatrix4(o.matrixWorld); } });
  if (!src) return null;
  if (flip) src.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
  src.computeBoundingBox();
  return src;
}

function bendOneFestoon(srcGeo, { th0, span, depth, attachY, radius }) {
  const g = srcGeo.clone();
  g.computeBoundingBox();
  const bb = g.boundingBox, min = bb.min.clone(), size = new THREE.Vector3(); bb.getSize(size);
  const ax = ['x', 'y', 'z'];
  const lenAxis = ax.reduce((a, b) => (size[b] > size[a] ? b : a), 'x'); // longest = strip length
  const cross = ax.filter(a => a !== lenAxis);
  const L = size[lenAxis];
  const uscale = (span * radius) / L; // stretch cross-section like the length → bumps stay proportional
  const outAxis = size[cross[0]] >= size[cross[1]] ? cross[0] : cross[1]; // bump axis (sticks out)
  const widthAxis = outAxis === cross[0] ? cross[1] : cross[0];
  const cOut = min[outAxis] + size[outAxis] / 2, cW = min[widthAxis] + size[widthAxis] / 2;
  const outHalf = (size[outAxis] / 2) * uscale;
  const R = radius + outHalf; // sit proud of the wall
  const pos = g.attributes.position, v = new THREE.Vector3();
  const curve = t => {
    const th = th0 + (t - 0.5) * span;
    const cy = attachY - depth * (1 - Math.pow(2 * t - 1, 2)); // U: belly at t=0.5, ends at attachY
    return { p: new THREE.Vector3(Math.cos(th) * R, cy, Math.sin(th) * R), th };
  };
  for (let i = 0; i < pos.count; i++) {
    const comp = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
    const t = (comp[lenAxis] - min[lenAxis]) / L;
    const oOut = (comp[outAxis] - cOut) * uscale, oW = (comp[widthAxis] - cW) * uscale;
    const cur = curve(t), nxt = curve(Math.min(1, t + 1e-3)), prv = curve(Math.max(0, t - 1e-3));
    const T = new THREE.Vector3().subVectors(nxt.p, prv.p).normalize();      // tangent along the U
    const Rhat = new THREE.Vector3(Math.cos(cur.th), 0, Math.sin(cur.th));   // radial out (bumps)
    const B = new THREE.Vector3().crossVectors(T, Rhat).normalize();         // in-wall perpendicular
    v.copy(cur.p).addScaledVector(Rhat, oOut).addScaledVector(B, oW);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

function buildFestoons(scene, { flip, festoons, depth, attachY, radius, spread = 0.96 }) {
  const src = bakeStrip(scene, flip);
  if (!src) return [];
  const span = (2 * Math.PI / festoons) * spread; // each U spans its share of the ring (small gap)
  return Array.from({ length: festoons }, (_, k) =>
    bendOneFestoon(src, { th0: Math.PI / 2 + k * (2 * Math.PI / festoons), span, depth, attachY, radius }));
}

// ── same extractGeo as CakeTier ───────────────────────────────────────────────
function extractGeo(scene) {
  let geo = null;
  scene.traverse(obj => {
    if (obj.isMesh && !geo) geo = obj.geometry.clone();
  });
  if (!geo) return null;
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  geo.computeBoundingBox();
  const box  = geo.boundingBox;
  const size = new THREE.Vector3(); box.getSize(size);
  const ctr  = new THREE.Vector3(); box.getCenter(ctr);
  geo.translate(-ctr.x, -box.min.y, -ctr.z);
  return { geo, sizeY: size.y };
}

// ── Single positioned piece ───────────────────────────────────────────────────
function CalibScene({ glbUrl, cfg, showRing, anchorY, inward }) {
  const { scene } = useGLTF(glbUrl);

  const { geometry, shellScale, bbDepth, bbWidth } = useMemo(() => {
    const result = extractGeo(scene);
    if (!result) return { geometry: null, shellScale: 1, bbDepth: 0, bbWidth: 0 };
    const geo = result.geo;
    if (cfg.flipBottom) {
      geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
      geo.computeBoundingBox();
      geo.translate(0, -geo.boundingBox.min.y, 0);
    }
    const sc = (CAKE_RADIUS * 0.24) / result.sizeY;
    geo.computeBoundingBox();
    const bb = new THREE.Vector3(); geo.boundingBox.getSize(bb);
    return { geometry: geo, shellScale: sc, bbDepth: bb.z, bbWidth: bb.x };
  }, [scene, cfg.flipBottom]);

  // Ring positions — identical formula to BottomPipingRing in the designer
  const positions = useMemo(() => {
    if (!geometry) return [];
    // Board hugs the side wall (outward); rim sits on the top surface (inward).
    const halfDepth = (bbDepth / 2) * shellScale;
    const r    = CAKE_RADIUS + (inward ? -halfDepth : halfDepth) + cfg.radialOffset;
    const step = shellScale * bbWidth * 0.9;
    if (cfg.swagCount > 0 && cfg.swagDepth > 0) {
      return buildSwagRing({ r, baseY: anchorY + cfg.yOffset, step, swagCount: cfg.swagCount, swagDepth: cfg.swagDepth, swagTilt: cfg.swagTilt });
    }
    const count = Math.max(6, Math.round((2 * Math.PI * CAKE_RADIUS) / step));
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return { pos: [Math.cos(angle) * r, anchorY + cfg.yOffset, Math.sin(angle) * r], rotY: angle, tq: [0, 0, 0, 1] };
    });
  }, [geometry, shellScale, bbDepth, bbWidth, cfg.radialOffset, cfg.yOffset, cfg.swagCount, cfg.swagDepth, cfg.swagTilt, anchorY, inward]);

  // Bend mode: deform the whole strip into U festoons draped on the wall.
  const festoonGeos = useMemo(() => {
    if (!cfg.bend) return null;
    return buildFestoons(scene, {
      flip: false, // bend builds its own orientation (bumps point outward); ring-flip not used here
      festoons: cfg.festoons,
      depth: cfg.bendDepth,
      attachY: anchorY + cfg.yOffset,
      radius: CAKE_RADIUS + cfg.radialOffset,
    });
  }, [scene, cfg.bend, cfg.festoons, cfg.bendDepth, cfg.yOffset, cfg.radialOffset, anchorY]);

  if (!geometry) return null;

  if (festoonGeos) {
    return (
      <>
        {festoonGeos.map((g, i) => (
          <mesh key={i} geometry={g} castShadow>
            <meshPhysicalMaterial color="#f5e6c8" roughness={0.85}
              sheen={0.4} sheenRoughness={0.9} sheenColor="#f5e6c8" />
          </mesh>
        ))}
      </>
    );
  }

  // Y onto the group, X+Z onto the mesh — same split as BottomPipingRing
  const ryGroup = cfg.ry * DEG;
  const meshRot = [cfg.rx * DEG, 0, cfg.rz * DEG];
  const pts = showRing ? positions : (positions.length ? [positions[0]] : []);

  return (
    <>
      {pts.map((u, i) => (
        <group key={i} position={u.pos} quaternion={u.tq}>
          <group rotation={[0, -u.rotY + Math.PI / 2 + ryGroup, 0]}>
            <mesh geometry={geometry} rotation={meshRot} scale={shellScale} castShadow>
              <meshPhysicalMaterial color="#f5e6c8" roughness={0.85}
                sheen={0.4} sheenRoughness={0.9} sheenColor="#f5e6c8" />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

// ── Cake + board backdrop ─────────────────────────────────────────────────────
function CakeScene() {
  return (
    <>
      {/* Board */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[CAKE_RADIUS + 0.6, CAKE_RADIUS + 0.6, 0.1, 64]} />
        <meshStandardMaterial color="#d4af37" roughness={0.15} metalness={0.75} />
      </mesh>
      {/* Cake */}
      <mesh position={[0, Y_BASE + CAKE_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[CAKE_RADIUS, CAKE_RADIUS, CAKE_HEIGHT, 64]} />
        <meshStandardMaterial color="#f5c6d0" roughness={0.68} />
      </mesh>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#f0ebe5" roughness={0.9} />
      </mesh>
    </>
  );
}

// ── Slider row ────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, onChange, color = '#3D5A44' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 90, fontFamily: "'Quicksand',sans-serif" }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: color }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#2C4433', minWidth: 46, textAlign: 'right', fontFamily: "'Quicksand',sans-serif" }}>
        {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}
      </span>
      <button onClick={() => onChange(0)}
        style={{ fontSize: 10, padding: '2px 6px', border: '1px solid #C5D4C8', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#9BB5A2', fontFamily: "'Quicksand',sans-serif" }}>
        0
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const DEFAULT_TARGET_CFG = {
  flipBottom:   true,
  rx: 0, ry: 0, rz: 0,
  radialOffset: 0,
  yOffset:      0,
  swagCount:    0,   // festoons around the ring (0 = flat ring, no swag). 2–3 = big U drapes.
  swagDepth:    0.4, // how far each festoon hangs (cake units)
  swagTilt:     0.4, // how strongly shells lean to follow the drape (0–1; ~0.4 looks best)
  bend:         false, // bend the whole strip into U festoons (one strip = one U swag)
  festoons:     6,   // how many U swags around the cake (1 = one big U at the front)
  bendDepth:    0.4, // how far each U belly hangs below the attachment ends (cake units)
};

// Map one edited config to its placement_config section. board → bottom_*, rim → top_*.
// These are the exact keys the designer's pipingPlacementFromConfig() reads.
function sectionFor(prefix, c) {
  return {
    [`${prefix}_flip`]:          c.flipBottom,
    [`${prefix}_rotation`]:      [Math.round(c.rx), Math.round(c.ry), Math.round(c.rz)],
    [`${prefix}_radial_offset`]: +c.radialOffset.toFixed(3),
    [`${prefix}_y_offset`]:      +c.yOffset.toFixed(3),
    [`${prefix}_swag_count`]:    Math.round(c.swagCount),
    [`${prefix}_swag_depth`]:    +c.swagDepth.toFixed(3),
    [`${prefix}_swag_tilt`]:     +c.swagTilt.toFixed(2),
  };
}

export default function PipingCalibrator() {
  const [file, setFile]     = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [showRing, setShowRing] = useState(false);
  const [target, setTarget] = useState('board'); // which config the sliders edit: 'board' | 'rim'

  // Independent configs — the board ring sits OUTSIDE the wall, the rim pulls INWARD,
  // so each needs its own rotation/offsets. The Board/Rim selector just swaps which one
  // the sliders drive; both rings always render together on the cake.
  const [boardCfg, setBoardCfg] = useState({ ...DEFAULT_TARGET_CFG });
  const [rimCfg,   setRimCfg]   = useState({ ...DEFAULT_TARGET_CFG, flipBottom: false });

  // Which sections get written to the output JSON — board-only / rim-only / both.
  const [includeBoard, setIncludeBoard] = useState(true);
  const [includeRim,   setIncludeRim]   = useState(true);

  const cfg    = target === 'board' ? boardCfg : rimCfg;
  const setCfg = target === 'board' ? setBoardCfg : setRimCfg;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function set(key) { return v => setCfg(prev => ({ ...prev, [key]: v })); }

  // One combined placement_config fragment — only the checked sections are written, so
  // the same paste covers board-only, rim-only, or both. Merge it straight into an
  // element's placement_config (ManageElements "Paste from Piping Calibrator").
  const valuesJson = JSON.stringify({
    ...(includeBoard ? sectionFor('bottom', boardCfg) : {}),
    ...(includeRim   ? sectionFor('top',    rimCfg)   : {}),
  }, null, 2);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', fontFamily: "'Quicksand',sans-serif", background: '#EDEAE2' }}>

      {/* ── Left: controls ─────────────────────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0, overflowY: 'auto', background: '#fff', borderRight: '1.5px solid #E8EFE9', padding: 20, position: 'relative', zIndex: 10 }}>

        <div style={{ fontSize: 15, fontWeight: 800, color: '#2C4433', marginBottom: 16 }}>Piping Calibrator</div>

        {/* GLB upload */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B8C74', marginBottom: 4 }}>GLB File</div>
          <div style={{ border: '2px dashed #C5D4C8', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', background: '#F4F8F5', fontSize: 12, color: '#9BB5A2', textAlign: 'center' }}>
            {file ? file.name : 'Click to pick .glb file'}
            <input type="file" accept=".glb,.gltf" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
          </div>
        </label>

        {blobUrl && (
          <>
            {/* Target: rim (top edge) vs board (base) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B8C74', marginBottom: 4 }}>Edit values for (both rings shown)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ v: 'board', label: 'Board (base)' }, { v: 'rim', label: 'Rim (top edge)' }].map(({ v, label }) => (
                  <button key={v} onClick={() => setTarget(v)}
                    style={{ flex: 1, fontSize: 11, padding: '6px 0', borderRadius: 6, border: `2px solid ${target === v ? '#3D5A44' : '#C5D4C8'}`, background: target === v ? '#3D5A44' : '#fff', color: target === v ? '#fff' : '#6B8C74', cursor: 'pointer', fontWeight: 700, fontFamily: "'Quicksand',sans-serif" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Flip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3D5A44' }}>Flip (180° X on geometry)</span>
              <button onClick={() => setCfg(p => ({ ...p, flipBottom: !p.flipBottom }))}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `2px solid ${cfg.flipBottom ? '#3D5A44' : '#C5D4C8'}`, background: cfg.flipBottom ? '#3D5A44' : '#fff', color: cfg.flipBottom ? '#fff' : '#6B8C74', cursor: 'pointer', fontWeight: 700 }}>
                {cfg.flipBottom ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Rotation */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9B5F72', marginBottom: 6, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Rotation (degrees)</div>
            <Slider label="X rotation" value={cfg.rx} min={-180} max={180} onChange={set('rx')} color="#e05252" />
            <Slider label="Y rotation" value={cfg.ry} min={-180} max={180} onChange={set('ry')} color="#52c452" />
            <Slider label="Z rotation" value={cfg.rz} min={-180} max={180} onChange={set('rz')} color="#5252e0" />

            {/* Position tweaks */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9B5F72', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Position</div>
            <Slider label="Radial offset" value={cfg.radialOffset} min={-0.3} max={0.5} step={0.01} onChange={set('radialOffset')} />
            <Slider label="Y offset" value={cfg.yOffset} min={-0.2} max={1.2} step={0.01} onChange={set('yOffset')} />

            {/* Bend into U — bend the whole strip into draped U swags */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9B5F72', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Bend into U (swag)</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3D5A44' }}>Bend the strip into a U</span>
              <button onClick={() => setCfg(p => ({ ...p, bend: !p.bend, yOffset: (!p.bend && p.yOffset === 0) ? 0.9 : p.yOffset }))}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `2px solid ${cfg.bend ? '#3D5A44' : '#C5D4C8'}`, background: cfg.bend ? '#3D5A44' : '#fff', color: cfg.bend ? '#fff' : '#6B8C74', cursor: 'pointer', fontWeight: 700 }}>
                {cfg.bend ? 'ON' : 'OFF'}
              </button>
            </div>
            {cfg.bend && <>
              <Slider label="Festoons" value={cfg.festoons} min={1} max={12} step={1} onChange={set('festoons')} />
              <Slider label="Bend depth" value={cfg.bendDepth} min={0.05} max={0.9} step={0.01} onChange={set('bendDepth')} />
              <div style={{ fontSize: 10, color: '#9BB5A2', marginTop: -2, marginBottom: 6, lineHeight: 1.5 }}>
                One strip bends into one U. <b>Festoons</b> = how many U swags around (1 = a single big
                U at the front). <b>Bend depth</b> = how far each U hangs. <b>Y offset</b> sets the
                attachment height up the wall.
              </div>
            </>}

            {/* Swag / drape — bend the ring into scallops like a garland border */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9B5F72', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Swag / Drape</div>
            <Slider label="Swag count" value={cfg.swagCount} min={0} max={12} step={1}
              onChange={v => {
                // Activating swag: show the ring and lift the ATTACHMENT points to a fixed mid-wall
                // height (SWAG_LIFT) so the festoon hangs on the side. Depth then drops the belly
                // DOWN from there — attachment height stays put, so depth deepens the U (not raises it).
                setCfg(p => ({ ...p, swagCount: v, yOffset: (v > 0 && p.yOffset === 0) ? SWAG_LIFT : p.yOffset }));
                if (v > 0) setShowRing(true);
              }} />
            <Slider label="Swag depth" value={cfg.swagDepth} min={0} max={1} step={0.01}
              onChange={v => {
                // Depth only shows on the full ring — so dragging it activates the swag: enable the
                // ring, default to 2 festoons, and lift the attachment height (once) if not already.
                setCfg(p => {
                  const count = (p.swagCount === 0 && v > 0) ? 2 : p.swagCount;
                  const yOffset = (count > 0 && p.yOffset === 0) ? SWAG_LIFT : p.yOffset;
                  return { ...p, swagDepth: v, swagCount: count, yOffset };
                });
                if (v > 0) setShowRing(true);
              }} />
            <Slider label="Swag tilt" value={cfg.swagTilt} min={0} max={1} step={0.05}
              onChange={v => {
                setCfg(p => ({ ...p, swagTilt: v, swagCount: (p.swagCount === 0 && p.swagDepth > 0) ? 2 : p.swagCount }));
                setShowRing(true);
              }} />
            <div style={{ fontSize: 10, color: '#9BB5A2', marginTop: -2, marginBottom: 6, lineHeight: 1.5 }}>
              <b>Count</b> = number of U festoons (2–3 = big U drapes; higher = small ripples).
              <b> Depth</b> = how far each U hangs down. <b>Y offset</b> = attachment height on the wall
              (auto-lifted when swag turns on). <b>Tilt</b> ~0.4 — near 1 over-rolls chunky shells.
              {cfg.swagCount > 0 && !showRing && <><br/>Turn on “Show full ring” to see the swag.</>}
            </div>

            {/* Ring toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3D5A44' }}>Show full ring</span>
              <button onClick={() => setShowRing(r => !r)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `2px solid ${showRing ? '#3D5A44' : '#C5D4C8'}`, background: showRing ? '#3D5A44' : '#fff', color: showRing ? '#fff' : '#6B8C74', cursor: 'pointer', fontWeight: 700 }}>
                {showRing ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Include in output — board-only / rim-only / both */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#9B5F72', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Include in JSON</div>
              {[{ k: 'board', on: includeBoard, setter: setIncludeBoard, label: 'Board (base)' },
                { k: 'rim',   on: includeRim,   setter: setIncludeRim,   label: 'Rim (top edge)' }].map(row => (
                <label key={row.k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={row.on} onChange={e => row.setter(e.target.checked)} style={{ accentColor: '#3D5A44', width: 15, height: 15 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3D5A44', fontFamily: "'Quicksand',sans-serif" }}>{row.label}</span>
                </label>
              ))}
              <div style={{ fontSize: 10, color: '#9BB5A2', marginTop: 2, lineHeight: 1.5 }}>
                Only checked sections are written. Board → <code>bottom_*</code>, Rim → <code>top_*</code>.
              </div>
            </div>

            {/* Values readout */}
            <div style={{ marginTop: 20, background: '#F4F8F5', border: '1.5px solid #C5D4C8', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#3D5A44', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Values to share</div>
              <pre style={{ fontSize: 12, color: '#2C4433', margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{valuesJson}</pre>
              <button onClick={() => navigator.clipboard?.writeText(valuesJson)}
                style={{ marginTop: 10, width: '100%', padding: '8px 0', background: '#3D5A44', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Quicksand',sans-serif" }}>
                Copy to clipboard
              </button>
            </div>
          </>
        )}

        {!blobUrl && (
          <div style={{ marginTop: 20, padding: 16, background: '#F4F8F5', borderRadius: 10, fontSize: 12, color: '#9BB5A2', lineHeight: 1.6, border: '1.5px dashed #C5D4C8' }}>
            Upload a GLB file to start. Use the Board / Rim selector to tune each ring — both render together on the cake. Tick which zones to include, then share the "Values" box.
          </div>
        )}
      </div>

      {/* ── Right: 3D canvas ────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Canvas shadows camera={{ position: [0, 5.5, 7.9], fov: 42 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 10, 5]} intensity={1.4} castShadow />
          <directionalLight position={[-3, 3, -3]} intensity={0.3} />
          <color attach="background" args={['#f4f0ea']} />
          <Environment preset="apartment" backgroundBlurriness={1} />

          <CakeScene />

          <Suspense fallback={null}>
            {/* Both rings render together; a ring shows when it's included OR being edited. */}
            {blobUrl && (includeBoard || target === 'board') && (
              <CalibScene glbUrl={blobUrl} cfg={boardCfg} showRing={showRing} anchorY={Y_BASE} inward={false} />
            )}
            {blobUrl && (includeRim || target === 'rim') && (
              <CalibScene glbUrl={blobUrl} cfg={rimCfg} showRing={showRing} anchorY={Y_BASE + CAKE_HEIGHT} inward={true} />
            )}
          </Suspense>

          <OrbitControls makeDefault target={[0, 2, 0]} />
        </Canvas>

        {!blobUrl && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 12, padding: '16px 24px', fontSize: 13, color: '#9BB5A2', fontWeight: 700, fontFamily: "'Quicksand',sans-serif" }}>
              Upload a GLB to see the piece on the cake
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
