import { useState, useCallback, useMemo } from 'react';
import { PatternBuilderCanvas, getOverlappingIds } from '@spattoo/designer';
import { supabase } from '../lib/supabase.js';

const DEMO_RADIUS = 1.2;
const DEMO_TOP_Y  = 1.55;   // BOTTOM_BASE + BOTTOM_H

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    display: 'flex', height: '100vh', fontFamily: "'Quicksand', sans-serif",
    background: '#faf6f1', overflow: 'hidden',
  },
  sidebar: {
    width: 300, minWidth: 300, background: '#fff',
    borderRight: '1px solid #f0dce3',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '18px 20px 14px', borderBottom: '1px solid #f0dce3', flexShrink: 0,
  },
  title: {
    fontSize: 16, fontWeight: 800, color: '#6b2d42',
    fontFamily: "'Playfair Display', serif", margin: 0,
  },
  sidebarBody: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  sidebarFooter: {
    padding: '14px 20px', borderTop: '1px solid #f0dce3', flexShrink: 0,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  canvasWrap: { flex: 1, position: 'relative' },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#9b5f72',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5,
  },
  input: {
    width: '100%', padding: '8px 12px', border: '1.5px solid #f0dce3',
    borderRadius: 8, fontSize: 13, fontFamily: "'Quicksand', sans-serif",
    color: '#2d1b0e', outline: 'none', boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '8px 10px', border: '1.5px solid #f0dce3',
    borderRadius: 8, fontSize: 12, fontFamily: "'Quicksand', sans-serif",
    color: '#2d1b0e', background: '#fff', outline: 'none', boxSizing: 'border-box',
  },
  btn: {
    padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 12,
  },
  btnPrimary: { background: '#9b5f72', color: '#fff' },
  btnSecondary: {
    background: '#fff', color: '#9b5f72', border: '1.5px solid #f0dce3',
  },
  btnDanger: { background: '#fff', color: '#c0392b', border: '1.5px solid #f5c6c6' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#9b5f72',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  placementRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
    marginBottom: 4, border: '1.5px solid transparent',
  },
  placementRowSelected: {
    border: '1.5px solid #9b5f72', background: '#fdf5f8',
  },
  placementRowOverlap: {
    border: '1.5px solid #e74c3c', background: '#fff5f5',
  },
  sliderRow: { marginBottom: 12 },
  sliderLabel: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabelText: { fontSize: 11, fontWeight: 700, color: '#9b5f72', letterSpacing: 0.5 },
  sliderValue: { fontSize: 11, color: '#666', fontVariantNumeric: 'tabular-nums' },
  slider: { width: '100%', accentColor: '#9b5f72' },
  overlapBadge: {
    background: '#ffeaea', color: '#c0392b', borderRadius: 6,
    padding: '6px 10px', fontSize: 11, fontWeight: 700, marginBottom: 12,
  },
  noPlacement: {
    fontSize: 12, color: '#aaa', textAlign: 'center', padding: '20px 0',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function newPlacement(surface = 'top', overrides = {}) {
  const base = {
    id:    crypto.randomUUID(),
    type:  'sphere',
    surface,
    r:     0.075,
    color: '#D4AF37',
  };
  if (surface === 'gap') {
    return { ...base, parentA: null, parentB: null, gapAngle: 0, ...overrides };
  }
  return {
    ...base,
    thetaOffset: 0,
    rdInset:     0.08,
    yFromTop:    0.1,
    ...overrides,
  };
}

function SliderControl({ label, value, min, max, step = 0.001, onChange, display }) {
  return (
    <div style={s.sliderRow}>
      <div style={s.sliderLabel}>
        <span style={s.sliderLabelText}>{label}</span>
        <span style={s.sliderValue}>{display ?? value.toFixed(3)}</span>
      </div>
      <input
        type="range" style={s.slider}
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PatternBuilder() {
  const [name,        setName]        = useState('');
  const [placements,  setPlacements]  = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState(null);
  const [savedSlug,   setSavedSlug]   = useState(null);

  const overlappingIds = useMemo(
    () => getOverlappingIds(placements, DEMO_TOP_Y, DEMO_RADIUS),
    [placements],
  );

  const selected = placements.find(p => p.id === selectedId) ?? null;

  // ── Placement mutations ──────────────────────────────────────────────────────

  function addPlacement(surface = 'top', overrides = {}) {
    let extra = overrides;
    if (surface !== 'gap') {
      const autoTheta = 'thetaOffset' in overrides
        ? overrides.thetaOffset
        : (placements.length * (Math.PI / 4)) % (Math.PI * 2) - Math.PI;
      extra = { thetaOffset: autoTheta, ...overrides };
    }
    const p = newPlacement(surface, extra);
    setPlacements(prev => [...prev, p]);
    setSelectedId(p.id);
  }

  function updateSelected(changes) {
    setPlacements(prev => prev.map(p => p.id === selectedId ? { ...p, ...changes } : p));
  }

  function deleteSelected() {
    setPlacements(prev => prev.filter(p => p.id !== selectedId));
    setSelectedId(null);
  }

  // ── Canvas callbacks ─────────────────────────────────────────────────────────

  const onCakeTopClick = useCallback(({ thetaOffset }) => {
    addPlacement('top', { thetaOffset });
  }, []);

  const onCakeSideClick = useCallback(({ thetaOffset, yFromTop }) => {
    addPlacement('side', { thetaOffset, yFromTop });
  }, []);

  const onDragPlacement = useCallback((id, changes) => {
    setPlacements(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) { setSaveError('Pattern name is required.'); return; }
    if (overlappingIds.size > 0) { setSaveError('Fix overlapping balls before saving.'); return; }
    if (placements.length === 0) { setSaveError('Add at least one placement.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { error } = await supabase.from('patterns').insert({
        name: name.trim(),
        slug,
        placements,
      });
      if (error) throw error;
      setSavedSlug(slug);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>

      {/* ── Sidebar ── */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <p style={s.title}>Pattern Builder</p>
        </div>

        <div style={s.sidebarBody}>

          {/* Pattern name */}
          <div style={s.section}>
            <label style={s.label}>Pattern name</label>
            <input
              style={s.input}
              value={name}
              onChange={e => { setName(e.target.value); setSavedSlug(null); }}
              placeholder="e.g. Gold Cluster"
            />
          </div>

          {/* Add buttons */}
          <div style={{ ...s.section, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={{ ...s.btn, ...s.btnSecondary, flex: 1 }} onClick={() => addPlacement('top')}>
              + Top
            </button>
            <button style={{ ...s.btn, ...s.btnSecondary, flex: 1 }} onClick={() => addPlacement('side')}>
              + Side
            </button>
            <button
              style={{ ...s.btn, ...s.btnSecondary, flex: 1 }}
              disabled={placements.filter(p => p.surface !== 'gap').length < 2}
              onClick={() => addPlacement('gap')}
              title="Ball resting in the gap between two other balls"
            >
              + Gap
            </button>
          </div>

          {/* Overlap warning */}
          {overlappingIds.size > 0 && (
            <div style={s.overlapBadge}>
              ⚠ {overlappingIds.size} ball{overlappingIds.size > 1 ? 's' : ''} overlapping
            </div>
          )}

          {/* Placements list */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Placements ({placements.length})</div>
            {placements.length === 0 && (
              <div style={s.noPlacement}>Click + to add balls, or click the cake</div>
            )}
            {placements.map((p, i) => {
              const isSelected  = p.id === selectedId;
              const isOverlap   = overlappingIds.has(p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    ...s.placementRow,
                    ...(isSelected ? s.placementRowSelected : {}),
                    ...(isOverlap  ? s.placementRowOverlap  : {}),
                  }}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: p.color ?? '#D4AF37', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: '#444', flex: 1 }}>
                    Ball {i + 1} · {p.surface}{p.surface === 'gap' ? '' : ''} · r={p.r.toFixed(3)}
                  </span>
                  {isOverlap && <span style={{ fontSize: 10, color: '#e74c3c' }}>overlap</span>}
                </div>
              );
            })}
          </div>

          {/* Selected placement controls */}
          {selected && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Edit Ball {placements.findIndex(p => p.id === selectedId) + 1}</div>

              {/* ── Gap ball controls ── */}
              {selected.surface === 'gap' && (() => {
                const nonGap = placements.filter(p => p.surface !== 'gap');
                const labelFor = (id) => {
                  const idx = placements.findIndex(p => p.id === id);
                  return idx >= 0 ? `Ball ${idx + 1}` : '—';
                };
                return (
                  <>
                    <div style={{ ...s.sliderRow, marginBottom: 12 }}>
                      <label style={s.label}>Parent A</label>
                      <select
                        style={s.select}
                        value={selected.parentA ?? ''}
                        onChange={e => updateSelected({ parentA: e.target.value || null })}
                      >
                        <option value="">— pick a ball —</option>
                        {nonGap.map((p, i) => (
                          <option key={p.id} value={p.id} disabled={p.id === selected.parentB}>
                            Ball {placements.findIndex(x => x.id === p.id) + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ ...s.sliderRow, marginBottom: 12 }}>
                      <label style={s.label}>Parent B</label>
                      <select
                        style={s.select}
                        value={selected.parentB ?? ''}
                        onChange={e => updateSelected({ parentB: e.target.value || null })}
                      >
                        <option value="">— pick a ball —</option>
                        {nonGap.map((p, i) => (
                          <option key={p.id} value={p.id} disabled={p.id === selected.parentA}>
                            Ball {placements.findIndex(x => x.id === p.id) + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selected.parentA && selected.parentB && (
                      <SliderControl
                        label="Rotate around axis"
                        value={selected.gapAngle ?? 0}
                        min={-Math.PI}
                        max={Math.PI}
                        step={0.01}
                        onChange={v => updateSelected({ gapAngle: v })}
                        display={`${((selected.gapAngle ?? 0) * 180 / Math.PI).toFixed(1)}°`}
                      />
                    )}

                    {(!selected.parentA || !selected.parentB) && (
                      <div style={{ fontSize: 11, color: '#9b5f72', padding: '4px 0 8px', fontWeight: 600 }}>
                        Select both parents to position this ball.
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── Top / Side controls ── */}
              {selected.surface !== 'gap' && (
                <>
                  <div style={{ ...s.sliderRow, marginBottom: 12 }}>
                    <label style={s.label}>Surface</label>
                    <select
                      style={s.select}
                      value={selected.surface}
                      onChange={e => updateSelected({ surface: e.target.value })}
                    >
                      <option value="top">Top</option>
                      <option value="side">Side</option>
                    </select>
                  </div>

                  <SliderControl
                    label="Angle (θ offset)"
                    value={selected.thetaOffset}
                    min={-Math.PI}
                    max={Math.PI}
                    step={0.01}
                    onChange={v => updateSelected({ thetaOffset: v })}
                    display={`${(selected.thetaOffset * 180 / Math.PI).toFixed(1)}°`}
                  />

                  {selected.surface === 'top' && (
                    <SliderControl
                      label="Inset from rim"
                      value={selected.rdInset}
                      min={0.01}
                      max={0.5}
                      step={0.001}
                      onChange={v => updateSelected({ rdInset: v })}
                    />
                  )}

                  {selected.surface === 'side' && (
                    <SliderControl
                      label="Drop below top"
                      value={selected.yFromTop}
                      min={0.01}
                      max={1.2}
                      step={0.001}
                      onChange={v => updateSelected({ yFromTop: v })}
                    />
                  )}
                </>
              )}

              {/* ── Shared: radius + color ── */}
              <SliderControl
                label="Radius (size)"
                value={selected.r}
                min={0.02}
                max={0.15}
                step={0.001}
                onChange={v => updateSelected({ r: v })}
              />

              <div style={{ ...s.sliderRow }}>
                <label style={s.label}>Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={selected.color ?? '#D4AF37'}
                    onChange={e => updateSelected({ color: e.target.value })}
                    style={{ width: 40, height: 32, border: '1.5px solid #f0dce3', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                  />
                  <span style={{ fontSize: 12, color: '#666' }}>{selected.color ?? '#D4AF37'}</span>
                </div>
              </div>

              <button style={{ ...s.btn, ...s.btnDanger, width: '100%', marginTop: 4 }} onClick={deleteSelected}>
                Delete ball
              </button>
            </div>
          )}

        </div>

        {/* Footer — save */}
        <div style={s.sidebarFooter}>
          {saveError && (
            <div style={{ fontSize: 11, color: '#c0392b', fontWeight: 700 }}>{saveError}</div>
          )}
          {savedSlug && (
            <div style={{ fontSize: 11, color: '#27ae60', fontWeight: 700 }}>
              ✓ Saved as "{savedSlug}"
            </div>
          )}
          <button
            style={{
              ...s.btn, ...s.btnPrimary,
              opacity: (saving || overlappingIds.size > 0 || !name.trim()) ? 0.5 : 1,
            }}
            disabled={saving || overlappingIds.size > 0 || !name.trim()}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Pattern'}
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={s.canvasWrap}>
        <PatternBuilderCanvas
          placements={placements}
          selectedId={selectedId}
          onSelectPlacement={setSelectedId}
          onCakeTopClick={onCakeTopClick}
          onCakeSideClick={onCakeSideClick}
          onDragPlacement={onDragPlacement}
        />
      </div>

    </div>
  );
}
