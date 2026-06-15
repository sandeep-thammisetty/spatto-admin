// Controlled, presentational craft-guide fields — nozzle recs (rank, brand,
// number, name, confidence), buttercream consistency and a technique tip, plus
// an optional "Fill with GPT" button. State is owned by the parent so this
// works both in the id-based CraftGuideEditor (ManageElements) and pre-creation
// in AddElement. Shared so both surfaces stay identical.

const BRAND_SUGGESTIONS = ['Wilton', 'Ateco', 'PME', 'JEM', 'Loyal', 'Generic'];
const CONSISTENCIES = [
  { value: '',       label: '— not set —' },
  { value: 'stiff',  label: 'Stiff' },
  { value: 'medium', label: 'Medium' },
  { value: 'soft',   label: 'Soft' },
];
export const RANKS = ['primary', 'secondary', 'alternative'];
const RANK_LABEL = { primary: 'Primary', secondary: 'Secondary', alternative: 'Alternative' };

const c = {
  subLabel: { display: 'block', fontSize: 10, fontWeight: 700, color: '#3A5563', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  recRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  input: {
    padding: '8px 10px', border: '1.5px solid #C9D9E0', borderRadius: 8,
    fontSize: 13, fontFamily: "'Quicksand', sans-serif", color: '#2C4433',
    background: '#fff', outline: 'none', boxSizing: 'border-box', minWidth: 0,
  },
  select: {
    padding: '8px 10px', border: '1.5px solid #C9D9E0', borderRadius: 8,
    fontSize: 13, fontFamily: "'Quicksand', sans-serif", color: '#2C4433',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  },
  removeBtn: {
    flex: '0 0 auto', width: 30, height: 30, borderRadius: 8, border: 'none',
    background: '#E6EEF2', color: '#7E97A2', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', lineHeight: 1,
  },
  addBtn: {
    marginTop: 2, padding: '7px 14px', borderRadius: 8, border: '1.5px dashed #B8CCD6',
    background: '#fff', color: '#3A5563', fontSize: 12, fontWeight: 700,
    fontFamily: "'Quicksand', sans-serif", cursor: 'pointer',
  },
  gptBtn: (busy, enabled) => ({
    padding: '6px 12px', borderRadius: 8, border: 'none',
    background: enabled ? '#6B4FA0' : '#C9C2D8', color: '#fff',
    fontSize: 11, fontWeight: 800, fontFamily: "'Quicksand', sans-serif",
    cursor: enabled && !busy ? 'pointer' : 'default', opacity: busy ? 0.7 : 1,
  }),
};

// Build a fresh empty rec. First one defaults to primary, the rest to secondary.
export function emptyRec(isFirst) {
  return { nozzle_id: null, brand: '', number: '', name: '', rank: isFirst ? 'primary' : 'secondary', confidence: null };
}

export default function CraftGuideFields({
  recs, setRecs, consistency, setConsistency, technique, setTechnique,
  onSuggest, suggesting = false, suggestError = null, canSuggest = false,
}) {
  function updateRec(i, patch) {
    setRecs(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRec() {
    setRecs(rs => [...rs, emptyRec(rs.length === 0)]);
  }
  function removeRec(i) {
    setRecs(rs => rs.filter((_, idx) => idx !== i));
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ ...c.subLabel, marginBottom: 0 }}>Recommended Nozzles</label>
        {onSuggest && (
          <button
            type="button"
            style={c.gptBtn(suggesting, canSuggest)}
            disabled={!canSuggest || suggesting}
            onClick={onSuggest}
            title={canSuggest ? 'Suggest nozzles from the thumbnail with GPT' : 'Add a thumbnail first'}
          >
            {suggesting ? 'Thinking…' : 'Fill with GPT'}
          </button>
        )}
      </div>

      <datalist id="craft-brand-list">
        {BRAND_SUGGESTIONS.map(b => <option key={b} value={b} />)}
      </datalist>
      {recs.length === 0 && (
        <div style={{ fontSize: 12, color: '#9aaeb8', marginBottom: 6 }}>No nozzles yet.</div>
      )}
      {recs.map((r, i) => (
        <div key={i} style={c.recRow}>
          <select
            style={{ ...c.select, flex: '0 1 110px' }}
            value={RANKS.includes(r.rank) ? r.rank : 'primary'}
            onChange={e => updateRec(i, { rank: e.target.value })}
            title="How this is presented to the baker on X-Ray"
          >
            {RANKS.map(rk => <option key={rk} value={rk}>{RANK_LABEL[rk]}</option>)}
          </select>
          <input
            list="craft-brand-list"
            style={{ ...c.input, flex: '1 1 80px' }}
            placeholder="Brand"
            value={r.brand ?? ''}
            onChange={e => updateRec(i, { brand: e.target.value, nozzle_id: null })}
          />
          <input
            style={{ ...c.input, flex: '0 1 70px' }}
            placeholder="No."
            value={r.number ?? ''}
            onChange={e => updateRec(i, { number: e.target.value, nozzle_id: null })}
          />
          <input
            style={{ ...c.input, flex: '2 1 110px' }}
            placeholder="Name (e.g. Petal Tip)"
            value={r.name ?? ''}
            onChange={e => updateRec(i, { name: e.target.value })}
          />
          {r.confidence != null && (
            <span title="GPT match confidence" style={{ flex: '0 0 auto', fontSize: 11, fontWeight: 700, color: '#7E97A2' }}>
              {Math.round(r.confidence * 100)}%
            </span>
          )}
          <button type="button" style={c.removeBtn} title="Remove" onClick={() => removeRec(i)}>×</button>
        </div>
      ))}
      <button type="button" style={c.addBtn} onClick={addRec}>+ Add nozzle</button>

      {suggestError && (
        <div style={{ fontSize: 11, color: '#c00', marginTop: 8 }}>{suggestError}</div>
      )}

      <div style={{ marginTop: 16 }}>
        <label style={c.subLabel}>Buttercream Consistency</label>
        <select style={{ ...c.select, width: '100%' }} value={consistency} onChange={e => setConsistency(e.target.value)}>
          {CONSISTENCIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={c.subLabel}>Technique Tip</label>
        <input
          style={{ ...c.input, width: '100%' }}
          placeholder="e.g. 90° to the surface, steady pressure, pull straight away"
          value={technique}
          onChange={e => setTechnique(e.target.value)}
        />
      </div>
    </>
  );
}
