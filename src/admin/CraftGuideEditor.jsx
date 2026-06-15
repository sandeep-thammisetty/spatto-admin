import { useState, useEffect } from 'react';
import { getCraftGuide, saveCraftGuide, suggestCraftGuide } from '../lib/api.js';
import CraftGuideFields, { RANKS } from './CraftGuideFields.jsx';

// Baker "craft guide" authoring — the X-Ray how-to-make-it metadata for a piping
// element. Stored in the element_craft_guide sidecar table (NOT placement_config,
// which is a canvas hot path). A pattern element unions the nozzle recs of its
// building-block parts at X-Ray time; here we just author one element's row.
// The fields themselves live in the shared CraftGuideFields component.

const c = {
  panel: { marginBottom: 20, padding: 16, borderRadius: 12, border: '1.5px solid #C9D9E0', background: '#F4F8FB' },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 11, fontWeight: 800, color: '#3A5563', letterSpacing: 1, textTransform: 'uppercase' },
  hint: { fontSize: 11, color: '#7E97A2', marginBottom: 14, fontFamily: "'Quicksand', sans-serif", lineHeight: 1.5 },
  saveBtn: (busy) => ({
    marginTop: 14, padding: '10px 0', width: '100%', borderRadius: 10, border: 'none',
    background: '#3A5563', color: '#fff', fontSize: 13, fontWeight: 800,
    fontFamily: "'Quicksand', sans-serif", cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
  }),
  msg: (ok) => ({ fontSize: 12, fontWeight: 600, textAlign: 'center', color: ok ? '#3A5563' : '#c00', marginTop: 10 }),
};

export default function CraftGuideEditor({ elementId, name, description, thumbnailUrl }) {
  const [recs,        setRecs]        = useState([]);
  const [consistency, setConsistency] = useState('');
  const [technique,   setTechnique]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [suggesting,  setSuggesting]  = useState(false);
  const [suggestError,setSuggestError]= useState(null);
  const [msg,         setMsg]         = useState(null);

  // Load this element's guide whenever the selected element changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMsg(null);
    setSuggestError(null);
    getCraftGuide(elementId)
      .then(g => {
        if (!alive) return;
        setRecs(g?.nozzle_recs ?? []);
        setConsistency(g?.consistency ?? '');
        setTechnique(g?.technique ?? '');
      })
      .catch(() => {
        if (!alive) return;
        setRecs([]); setConsistency(''); setTechnique('');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [elementId]);

  async function handleSuggest() {
    if (!thumbnailUrl) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const r = await suggestCraftGuide({ image_url: thumbnailUrl, name, description });
      setRecs(r.nozzle_recs ?? []);
      if (r.consistency) setConsistency(r.consistency);
      if (r.technique) setTechnique(r.technique);
      if (!r.nozzle_recs?.length) setSuggestError('GPT found no confident nozzle match — add manually.');
    } catch (err) {
      setSuggestError(err.message);
    } finally {
      setSuggesting(false);
    }
  }

  async function save() {
    const clean = recs
      .map(r => ({
        nozzle_id:  r.nozzle_id ?? null,
        brand:      (r.brand ?? '').trim(),
        number:     String(r.number ?? '').trim(),
        name:       (r.name ?? '').trim(),
        rank:       RANKS.includes(r.rank) ? r.rank : 'primary',
        confidence: r.confidence ?? null,
      }))
      .filter(r => r.brand && r.number);

    setSaving(true);
    setMsg(null);
    try {
      const saved = await saveCraftGuide(elementId, {
        nozzle_recs: clean,
        consistency: consistency || null,
        technique:   technique.trim() || null,
      });
      setRecs(saved.nozzle_recs ?? clean);
      setMsg({ ok: true, text: 'Craft guide saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={c.panel}>
      <div style={c.head}>Baker Craft Guide · X-Ray</div>
      <div style={c.hint}>
        How a baker recreates this piping. Tag the atomic blocks — a pattern automatically
        shows the combined nozzles of its parts in X-Ray.
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#7E97A2', padding: '6px 0' }}>Loading…</div>
      ) : (
        <>
          <CraftGuideFields
            recs={recs} setRecs={setRecs}
            consistency={consistency} setConsistency={setConsistency}
            technique={technique} setTechnique={setTechnique}
            onSuggest={handleSuggest} suggesting={suggesting} suggestError={suggestError}
            canSuggest={!!thumbnailUrl}
          />
          <button type="button" style={c.saveBtn(saving)} disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save Craft Guide'}
          </button>
          {msg && <div style={c.msg(msg.ok)}>{msg.text}</div>}
        </>
      )}
    </div>
  );
}
