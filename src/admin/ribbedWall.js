import * as THREE from 'three';

// ── PROTOTYPE: Ribbed cream wall (admin-only) ──────────────────────────────────
//
// Fat rounded HORIZONTAL ribs stacked up the wall — the "rib-comb" buttercream finish: `bands`
// semicircular tubes, each sitting proud with a thin shadow groove between, constant all the way
// around (no undulation). This lives in the admin app so we can tune the look in the Texture
// Calibrator first; once approved, this exact recipe ports to spattoo-core's geometry/creamWall.js
// (a `case 'ribbed'` in buildStyledWall + a matching makeWallReliefSampler arm).
//
// Mirrors core's displaceSide recipe (radial displacement of a dense cylinder's SIDE; caps stay flat;
// normals recomputed so shading is real) so the port is a copy.

// Shared 0..1 rib profile. sin²(π·frac) is a rounded tube — 0 at the groove, 1 at the crest. `round`
// is an exponent that fattens (>1, plateau crest + tighter groove) or flattens (<1) the tube.
// POSITIVE-only (ribs project outward, unlike wave's zero-net lines) → the wall radius grows ~amp/2,
// exactly like real piled-on ribs.
export function ribbedProfile(v, bands, round = 1) {
  const frac = v * bands - Math.floor(v * bands);
  const s = Math.sin(Math.PI * frac);
  return Math.pow(s * s, round);
}

function displaceSide(geo, fn) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox, yMin = bb.min.y, yH = (bb.max.y - bb.min.y) || 1;
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    if (Math.abs(n.y) > 0.5) continue;          // cap vertex — leave flat
    p.fromBufferAttribute(pos, i);
    const r = Math.hypot(p.x, p.z) || 1e-6;
    const v = (p.y - yMin) / yH;
    const sc = (r + fn(v)) / r;
    pos.setXYZ(i, p.x * sc, p.y, p.z * sc);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// `relief`/amp is a coefficient of radius (relief stays proportional across tiers). Height
// tessellation scales with the band count so the rounded tubes don't facet.
export function buildRibbedWall(radius, height, params = {}) {
  const bands = params.bands ?? 12;
  const round = params.round ?? 1.0;
  const a = (params.relief ?? 0.04) * radius;
  const heightSeg = Math.min(440, Math.max(200, bands * 24));
  const geo = new THREE.CylinderGeometry(radius, radius, height, 160, heightSeg);
  return displaceSide(geo, (v) => a * ribbedProfile(v, bands, round));
}

// Param schema mirroring the core CREAM_STYLES shape, so the calibrator's existing param UI drives it.
export const RIBBED_STYLE = {
  label: 'Ribbed', wall: 'ribbed',
  params: [
    { key: 'relief', label: 'Depth',     min: 0,   max: 0.12, step: 0.005, default: 0.04, user: true },
    { key: 'bands',  label: 'Ribs',      min: 4,   max: 24,   step: 1,     default: 12,   user: true },
    { key: 'round',  label: 'Roundness', min: 0.4, max: 2,    step: 0.1,   default: 1.0,  user: false },
  ],
};
