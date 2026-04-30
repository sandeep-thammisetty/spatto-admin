import { useState, useEffect } from 'react';
import { fetchAdminElementTypes, createElementType, updateElementType } from '../lib/api.js';

const ZONES = ['top_surface', 'side', 'middle_tier', 'board'];
const MODES = ['hug', 'stand'];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function PlacementGrid({ rules, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
      {ZONES.map(z => {
        const current = rules[z] ?? 'stand';
        return (
          <div key={z} style={{ background: '#F4F8F5', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B8C74', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              {z.replace(/_/g, ' ')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...rules, [z]: mode })}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontFamily: 'Quicksand, sans-serif', fontSize: 12, fontWeight: 700,
                    background: current === mode ? '#3D5A44' : '#E8EDE9',
                    color: current === mode ? '#fff' : '#6B8C74',
                  }}
                >
                  {mode === 'hug' ? 'Hug' : 'Stand'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlacementSummary({ rules }) {
  if (!rules || !Object.keys(rules).length) return <span style={{ color: '#C5D4C8' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {ZONES.map(z => {
        const mode = rules[z];
        if (!mode) return null;
        return (
          <span key={z} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: mode === 'hug' ? '#E8F5E9' : '#F4F8F5', color: mode === 'hug' ? '#2E7D32' : '#6B8C74' }}>
            {z.replace(/_/g, ' ')}: {mode}
          </span>
        );
      })}
    </div>
  );
}

export default function ElementTypes() {
  const [types, setTypes]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [name, setName]               = useState('');
  const [slug, setSlug]               = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [placementRules, setPlacementRules] = useState({});
  const [description, setDescription]       = useState('');
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setTypes(await fetchAdminElementTypes()); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setLoading(false); }
  }

  function handleNameChange(v) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function resetForm() {
    setName(''); setSlug(''); setSlugTouched(false); setDescription(''); setPlacementRules({});
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return setMsg({ ok: false, text: 'Name and slug are required' });
    setSaving(true);
    setMsg(null);
    try {
      const created = await createElementType({ name: name.trim(), slug: slug.trim(), description: description.trim() || null, placement_rules: placementRules });
      setTypes(prev => [...prev, created]);
      resetForm();
      setShowForm(false);
      setMsg({ ok: true, text: `"${created.name}" created` });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(type) {
    try {
      const updated = await updateElementType(type.id, { is_active: !type.is_active });
      setTypes(prev => prev.map(t => t.id === type.id ? updated : t));
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  const s = {
    page:       { minHeight: '100vh', background: '#EDEAE2', fontFamily: 'Quicksand, sans-serif', padding: '32px 24px' },
    back:       { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6B8C74', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginBottom: 24 },
    header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 640, margin: '0 auto 24px' },
    title:      { fontSize: 22, fontWeight: 800, color: '#2C4433' },
    card:       { background: '#fff', borderRadius: 18, border: '1.5px solid #C5D4C8', padding: 28, maxWidth: 640, margin: '0 auto 16px' },
    addBtn:     { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#3D5A44', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
    label:      { fontSize: 12, fontWeight: 700, color: '#6B8C74', display: 'block', marginBottom: 6 },
    sectionLbl: { fontSize: 11, fontWeight: 700, color: '#6B8C74', letterSpacing: 1, textTransform: 'uppercase' },
    input:      { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #C5D4C8', fontFamily: 'Quicksand, sans-serif', fontSize: 14, fontWeight: 600, color: '#2C4433', background: '#fff', boxSizing: 'border-box', outline: 'none' },
    row:        { display: 'flex', gap: 12, marginBottom: 20 },
    field:      { flex: 1 },
    saveBtn:    (disabled) => ({ padding: '10px 24px', borderRadius: 10, border: 'none', background: disabled ? '#9BB5A2' : '#3D5A44', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 14, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer' }),
    cancelBtn:  { padding: '10px 20px', borderRadius: 10, border: '1.5px solid #C5D4C8', background: '#fff', color: '#6B8C74', fontFamily: 'Quicksand, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    typeRow:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #EDF0EC' },
    typeName:   { fontSize: 15, fontWeight: 700, color: '#2C4433' },
    typeSlug:   { fontSize: 12, fontWeight: 600, color: '#9BB5A2', marginTop: 2 },
    badge:      (active) => ({ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: active ? '#E8F5E9' : '#F5F5F5', color: active ? '#2E7D32' : '#999', border: 'none', cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', flexShrink: 0 }),
    empty:      { textAlign: 'center', color: '#9BB5A2', fontWeight: 600, padding: '32px 0' },
    msg:        (ok) => ({ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: ok ? '#E8F5E9' : '#FFF0F0', color: ok ? '#2E7D32' : '#C0392B', maxWidth: 640, margin: '0 auto 16px' }),
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={s.page}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <a href="/" style={s.back}>← Back</a>
        </div>

        <div style={s.header}>
          <div style={s.title}>Element Types</div>
          <button style={s.addBtn} onClick={() => { setShowForm(f => !f); setMsg(null); if (showForm) resetForm(); }}>
            {showForm ? 'Cancel' : '+ New Type'}
          </button>
        </div>

        {msg && <div style={s.msg(msg.ok)}>{msg.text}</div>}

        {showForm && (
          <div style={s.card}>
            <form onSubmit={handleCreate}>
              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Name</label>
                  <input style={s.input} value={name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Surface Accent" autoFocus />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Slug</label>
                  <input style={s.input} value={slug} onChange={e => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="e.g. surface_accent" />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Description</label>
                <textarea
                  style={{ ...s.input, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Small decorative shapes that hug any cake surface — stars, hearts, sprinkles"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={s.sectionLbl}>Placement Rules</div>
                <p style={{ fontSize: 12, color: '#9BB5A2', fontWeight: 600, margin: '4px 0 0' }}>
                  Default placement for all elements of this type
                </p>
                <PlacementGrid rules={placementRules} onChange={setPlacementRules} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" style={s.saveBtn(saving)} disabled={saving}>
                  {saving ? 'Saving…' : 'Create'}
                </button>
                <button type="button" style={s.cancelBtn} onClick={() => { setShowForm(false); resetForm(); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={s.card}>
          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : types.length === 0 ? (
            <div style={s.empty}>No element types yet</div>
          ) : (
            types.map((t, i) => (
              <div key={t.id} style={{ ...s.typeRow, ...(i === types.length - 1 && { borderBottom: 'none' }) }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={s.typeName}>{t.name}</div>
                  <div style={s.typeSlug}>{t.slug}</div>
                  {t.description && <div style={{ fontSize: 12, color: '#6B8C74', fontWeight: 600, marginTop: 3 }}>{t.description}</div>}
                  <PlacementSummary rules={t.placement_rules} />
                </div>
                <button style={s.badge(t.is_active)} onClick={() => toggleActive(t)}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
