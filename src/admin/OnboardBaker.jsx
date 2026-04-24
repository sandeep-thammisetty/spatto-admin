import { useState } from 'react';
import { createBaker } from '../lib/api.js';

const TIERS = ['trial', 'starter', 'pro', 'enterprise'];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function OnboardBaker() {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    email: '',
    tagline: '',
    instagram_handle: '',
    website_url: '',
    primary_color: '#3D5A44',
    accent_color: '#C5D4C8',
    subscription_tier: 'trial',
    trial_ends_at: '',
    currency_code: 'INR',
    timezone: 'Asia/Kolkata',
  });
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleNameChange(e) {
    const value = e.target.value;
    set('name', value);
    if (!slugManual) set('slug', slugify(value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      if (payload.subscription_tier !== 'trial') delete payload.trial_ends_at;
      if (!payload.trial_ends_at) delete payload.trial_ends_at;
      const data = await createBaker(payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (result) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <div style={s.successTitle}>Baker created!</div>
          <div style={s.successSub}>Share these login details with the baker.</div>

          <div style={s.credBox}>
            <div style={s.credRow}>
              <span style={s.credLabel}>Email</span>
              <span style={s.credValue}>{form.email}</span>
            </div>
            <div style={s.credRow}>
              <span style={s.credLabel}>Temp password</span>
              <span style={s.credValue}>{result.tempPassword}</span>
            </div>
          </div>

          <button style={s.copyBtn} onClick={copyPassword}>
            {copied ? '✓ Copied' : 'Copy password'}
          </button>

          <button style={s.anotherBtn} onClick={() => {
            setResult(null);
            setForm({
              name: '', slug: '', email: '', tagline: '',
              instagram_handle: '', website_url: '',
              primary_color: '#3D5A44', accent_color: '#C5D4C8',
              subscription_tier: 'trial', trial_ends_at: '',
              currency_code: 'INR', timezone: 'Asia/Kolkata',
            });
            setSlugManual(false);
          }}>
            + Onboard another baker
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.pageTitle}>Onboard Baker</div>

        <form onSubmit={handleSubmit} style={s.form}>

          {/* ── Bakery info ── */}
          <div style={s.sectionLabel}>Bakery</div>

          <label style={s.label}>Business name *</label>
          <input
            style={s.input}
            value={form.name}
            onChange={handleNameChange}
            placeholder="Sweet Dreams Bakery"
            required
          />

          <label style={s.label}>Slug * <span style={s.hint}>used in URLs</span></label>
          <input
            style={s.input}
            value={form.slug}
            onChange={e => { setSlugManual(true); set('slug', slugify(e.target.value)); }}
            placeholder="sweet-dreams-bakery"
            required
          />

          <label style={s.label}>Tagline</label>
          <input
            style={s.input}
            value={form.tagline}
            onChange={e => set('tagline', e.target.value)}
            placeholder="Baked with love, served with joy"
          />

          {/* ── Contact ── */}
          <div style={{ ...s.sectionLabel, marginTop: 20 }}>Contact</div>

          <label style={s.label}>Email *</label>
          <input
            style={s.input}
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="baker@example.com"
            required
          />

          <label style={s.label}>Instagram handle</label>
          <div style={s.prefixWrap}>
            <span style={s.prefix}>@</span>
            <input
              style={{ ...s.input, borderRadius: '0 8px 8px 0', flex: 1 }}
              value={form.instagram_handle}
              onChange={e => set('instagram_handle', e.target.value)}
              placeholder="sweetdreamsbakery"
            />
          </div>

          <label style={s.label}>Website</label>
          <input
            style={s.input}
            type="url"
            value={form.website_url}
            onChange={e => set('website_url', e.target.value)}
            placeholder="https://sweetdreams.com"
          />

          {/* ── Branding ── */}
          <div style={{ ...s.sectionLabel, marginTop: 20 }}>Branding</div>

          <div style={s.colorRow}>
            <div style={s.colorField}>
              <label style={s.label}>Primary color</label>
              <div style={s.colorWrap}>
                <input type="color" value={form.primary_color}
                  onChange={e => set('primary_color', e.target.value)}
                  style={s.colorSwatch} />
                <input style={{ ...s.input, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  value={form.primary_color}
                  onChange={e => set('primary_color', e.target.value)} />
              </div>
            </div>
            <div style={s.colorField}>
              <label style={s.label}>Accent color</label>
              <div style={s.colorWrap}>
                <input type="color" value={form.accent_color}
                  onChange={e => set('accent_color', e.target.value)}
                  style={s.colorSwatch} />
                <input style={{ ...s.input, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  value={form.accent_color}
                  onChange={e => set('accent_color', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Subscription ── */}
          <div style={{ ...s.sectionLabel, marginTop: 20 }}>Subscription</div>

          <label style={s.label}>Tier</label>
          <div style={s.tierRow}>
            {TIERS.map(t => (
              <button
                key={t}
                type="button"
                style={{
                  ...s.tierBtn,
                  background: form.subscription_tier === t ? '#3D5A44' : '#fff',
                  color:      form.subscription_tier === t ? '#fff' : '#3D5A44',
                  borderColor: form.subscription_tier === t ? '#3D5A44' : '#C5D4C8',
                }}
                onClick={() => set('subscription_tier', t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {form.subscription_tier === 'trial' && (
            <>
              <label style={s.label}>Trial ends</label>
              <input
                style={s.input}
                type="date"
                value={form.trial_ends_at}
                onChange={e => set('trial_ends_at', e.target.value)}
              />
            </>
          )}

          {/* ── Locale ── */}
          <div style={{ ...s.sectionLabel, marginTop: 20 }}>Locale</div>

          <div style={s.localeRow}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Currency</label>
              <input style={s.input} value={form.currency_code}
                onChange={e => set('currency_code', e.target.value.toUpperCase())}
                placeholder="INR" maxLength={3} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={s.label}>Timezone</label>
              <input style={s.input} value={form.timezone}
                onChange={e => set('timezone', e.target.value)}
                placeholder="Asia/Kolkata" />
            </div>
          </div>

          {error && <div style={s.errorMsg}>{error}</div>}

          <button type="submit" style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving ? 'Creating baker…' : 'Create baker'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', background: '#EDEAE2',
    fontFamily: 'Quicksand, sans-serif',
    display: 'flex', justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    background: '#fff', borderRadius: 16,
    padding: '32px 36px', width: '100%', maxWidth: 540,
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
    border: '1.5px solid #C5D4C8',
    alignSelf: 'flex-start',
  },
  pageTitle: {
    fontSize: 20, fontWeight: 800, color: '#2C4433',
    marginBottom: 24, letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, color: '#6B8C74',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 10, paddingBottom: 6,
    borderBottom: '1px solid #E8EDE9',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: '#4A7459', letterSpacing: 0.3, marginTop: 8 },
  hint:  { fontSize: 10, fontWeight: 500, color: '#9BB5A3', marginLeft: 4 },
  input: {
    padding: '9px 12px', border: '1.5px solid #C5D4C8', borderRadius: 8,
    fontSize: 13, color: '#2C4433', outline: 'none',
    fontFamily: 'Quicksand, sans-serif', background: '#FAFCFA',
    width: '100%', boxSizing: 'border-box',
  },
  prefixWrap: { display: 'flex', alignItems: 'stretch' },
  prefix: {
    background: '#E8EDE9', border: '1.5px solid #C5D4C8',
    borderRight: 'none', borderRadius: '8px 0 0 8px',
    padding: '9px 10px', fontSize: 13, color: '#6B8C74', fontWeight: 700,
  },
  colorRow:  { display: 'flex', gap: 12 },
  colorField: { flex: 1, display: 'flex', flexDirection: 'column' },
  colorWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  colorSwatch: { width: 36, height: 36, border: '1.5px solid #C5D4C8', borderRadius: 8, cursor: 'pointer', padding: 2, background: 'none' },
  tierRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  tierBtn: {
    padding: '7px 16px', border: '1.5px solid', borderRadius: 20,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Quicksand, sans-serif', transition: 'all 0.15s',
  },
  localeRow: { display: 'flex', gap: 12 },
  errorMsg: {
    background: '#FFF0F0', border: '1.5px solid #F5C0C0',
    borderRadius: 8, padding: '10px 14px',
    color: '#C0392B', fontSize: 12, fontWeight: 600, marginTop: 8,
  },
  submitBtn: {
    marginTop: 20, padding: '13px',
    background: '#3D5A44', color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Quicksand, sans-serif',
    boxShadow: '0 4px 14px rgba(61,90,68,0.25)',
  },

  // Success screen
  successTitle: { fontSize: 22, fontWeight: 800, color: '#2C4433', marginBottom: 6 },
  successSub:   { fontSize: 13, color: '#6B8C74', marginBottom: 24 },
  credBox: {
    background: '#F4F8F5', border: '1.5px solid #C5D4C8',
    borderRadius: 10, padding: '14px 18px',
    display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16,
  },
  credRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  credLabel: { fontSize: 11, fontWeight: 700, color: '#6B8C74', letterSpacing: 0.3, minWidth: 100 },
  credValue: { fontSize: 13, fontWeight: 700, color: '#2C4433', fontFamily: 'monospace', wordBreak: 'break-all' },
  copyBtn: {
    width: '100%', padding: '11px',
    background: '#3D5A44', color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Quicksand, sans-serif', marginBottom: 10,
  },
  anotherBtn: {
    width: '100%', padding: '11px',
    background: '#fff', color: '#3D5A44',
    border: '1.5px solid #C5D4C8', borderRadius: 10,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Quicksand, sans-serif',
  },
};
