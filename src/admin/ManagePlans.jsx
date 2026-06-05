import { useState, useEffect } from 'react';
import { get, patch, post } from '../lib/api.js';

const s = {
  page:    { minHeight: '100vh', background: '#EDEAE2', fontFamily: "'Quicksand', sans-serif", padding: 32 },
  title:   { fontSize: 20, fontWeight: 800, color: '#2C4433', marginBottom: 24 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 },
  card:    { background: '#fff', borderRadius: 16, border: '1.5px solid #C5D4C8', overflow: 'hidden' },
  cardHdr: { padding: '16px 20px', borderBottom: '1px solid #E8EFE9', display: 'flex', alignItems: 'center', gap: 10 },
  cardBdy: { padding: '20px' },
  label:   { fontSize: 10, fontWeight: 700, color: '#9BB5A2', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, display: 'block' },
  inp:     { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #C5D4C8', fontSize: 13, fontFamily: "'Quicksand', sans-serif", color: '#2C4433', outline: 'none', boxSizing: 'border-box' },
  btn:     { padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'Quicksand', sans-serif" },
};

function fmt(paise) {
  if (!paise) return '—';
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

function PlanCard({ plan, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name:  plan.display_name,
    price_monthly: plan.price_monthly / 100,
    price_yearly:  plan.price_yearly / 100,
    is_active:     plan.is_active,
    features:      JSON.stringify(plan.features ?? {}, null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      let features;
      try { features = JSON.parse(form.features); } catch { throw new Error('Features must be valid JSON'); }
      await patch(`/api/admin/subscription-plans/${plan.id}`, {
        display_name:  form.display_name,
        price_monthly: Math.round(form.price_monthly * 100),
        price_yearly:  Math.round(form.price_yearly  * 100),
        is_active:     form.is_active,
        features,
      });
      onSave();
      setEditing(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={s.card}>
      <div style={s.cardHdr}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#2C4433' }}>{plan.display_name}</div>
          <div style={{ fontSize: 11, color: '#9BB5A2', fontWeight: 600, marginTop: 2 }}>{plan.name}</div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: plan.is_active ? '#D1FAE5' : '#F3F4F6',
          color:      plan.is_active ? '#065F46' : '#6B7280',
        }}>{plan.is_active ? 'Active' : 'Inactive'}</span>
        <button onClick={() => setEditing(e => !e)} style={{ ...s.btn, background: '#F4F8F5', color: '#2C4433', padding: '7px 14px' }}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div style={s.cardBdy}>
        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><div style={s.label}>Monthly</div><div style={{ fontSize: 18, fontWeight: 800, color: '#2C4433' }}>{fmt(plan.price_monthly)}</div></div>
              <div><div style={s.label}>Yearly</div><div style={{ fontSize: 18, fontWeight: 800, color: '#2C4433' }}>{fmt(plan.price_yearly)}</div></div>
            </div>
            <div>
              <div style={s.label}>Features</div>
              <pre style={{ fontSize: 11, color: '#555', background: '#F4F8F5', borderRadius: 8, padding: '10px 12px', margin: 0, overflow: 'auto' }}>
                {JSON.stringify(plan.features, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={s.label}>Display Name</label>
              <input style={s.inp} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Monthly Price (₹)</label>
                <input style={s.inp} type="number" value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Yearly Price (₹)</label>
                <input style={s.inp} type="number" value={form.price_yearly} onChange={e => setForm(f => ({ ...f, price_yearly: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={s.label}>Features (JSON)</label>
              <textarea style={{ ...s.inp, minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id={`active-${plan.id}`} checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor={`active-${plan.id}`} style={{ fontSize: 13, fontWeight: 600, color: '#2C4433', cursor: 'pointer' }}>Active</label>
            </div>
            {error && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
            <button onClick={handleSave} disabled={saving} style={{ ...s.btn, background: '#2C4433', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddPlanModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', display_name: '', price_monthly: '', price_yearly: '', features: '{}', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleCreate() {
    setSaving(true); setError(null);
    try {
      let features;
      try { features = JSON.parse(form.features); } catch { throw new Error('Features must be valid JSON'); }
      await post('/api/admin/subscription-plans', {
        name:          form.name.trim().toLowerCase(),
        display_name:  form.display_name.trim(),
        price_monthly: Math.round(parseFloat(form.price_monthly || 0) * 100),
        price_yearly:  Math.round(parseFloat(form.price_yearly  || 0) * 100),
        features,
        sort_order:    Number(form.sort_order),
      });
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420, maxWidth: 'calc(100vw - 40px)', display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#2C4433' }}>Add Plan</div>
        {[['name','Slug (e.g. starter)'],['display_name','Display Name'],['price_monthly','Monthly Price (₹)'],['price_yearly','Yearly Price (₹)']].map(([key, label]) => (
          <div key={key}>
            <label style={s.label}>{label}</label>
            <input style={s.inp} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          </div>
        ))}
        <div>
          <label style={s.label}>Features (JSON)</label>
          <textarea style={{ ...s.inp, minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...s.btn, background: '#F4F8F5', color: '#2C4433', flex: 1 }}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={{ ...s.btn, background: '#2C4433', color: '#fff', flex: 1 }}>
            {saving ? 'Creating…' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagePlans() {
  const [plans,      setPlans]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);

  async function load() {
    setLoading(true);
    try { setPlans(await get('/api/admin/subscription-plans')); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={s.title}>Subscription Plans</div>
        <button onClick={() => setShowAdd(true)} style={{ ...s.btn, background: '#2C4433', color: '#fff', marginLeft: 'auto' }}>
          + Add Plan
        </button>
      </div>

      {loading && <div style={{ color: '#9BB5A2', fontSize: 14 }}>Loading…</div>}

      {!loading && (
        <div style={s.grid}>
          {plans.map(p => <PlanCard key={p.id} plan={p} onSave={load} />)}
          {plans.length === 0 && <div style={{ fontSize: 14, color: '#9BB5A2' }}>No plans yet. Add one to get started.</div>}
        </div>
      )}

      {showAdd && <AddPlanModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}
