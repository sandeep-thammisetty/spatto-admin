import React, { lazy, Suspense, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './lib/supabase.js';
import Login from './auth/Login.jsx';
import logo from './images/spattoo-green.png';
import { getSignedUploadUrl, uploadToR2, createTemplate } from './lib/api.js';

const CreateTemplate = lazy(() =>
  import('@spattoo/designer').then(m => ({ default: m.CreateTemplate }))
);
const AddElement       = lazy(() => import('./admin/AddElement.jsx'));
const OnboardBaker     = lazy(() => import('./admin/OnboardBaker.jsx'));
const ManageTemplates  = lazy(() => import('./admin/ManageTemplates.jsx'));
const DesignTemplate   = lazy(() => import('./admin/DesignTemplate.jsx'));
const GenerateShape    = lazy(() => import('./admin/GenerateShape.jsx'));
const ElementTypes     = lazy(() => import('./admin/ElementTypes.jsx'));
const PatternBuilder   = lazy(() => import('./admin/PatternBuilder.jsx'));

const ROUTES = {
  '/templates/create':    CreateTemplate,
  '/templates/design':    DesignTemplate,
  '/templates':           ManageTemplates,
  '/elements/add':        AddElement,
  '/elements/generate':   GenerateShape,
  '/elements/types':      ElementTypes,
  '/bakers/onboard':      OnboardBaker,
  '/patterns/build':      PatternBuilder,
};

const FALLBACK = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9b5f72' }}>
    Loading…
  </div>
);

function AppHeader() {
  const isHome = window.location.pathname === '/';
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 200,
      background: '#fff', borderBottom: '1.5px solid #C5D4C8',
      padding: '0 32px', height: 56,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {!isHome && (
        <a
          href="/"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8, border: '1.5px solid #C5D4C8',
            color: '#6B8C74', textDecoration: 'none', fontSize: 16, fontWeight: 700,
            background: '#F4F8F5', flexShrink: 0,
          }}
          title="Back to home"
        >
          ←
        </a>
      )}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <img src={logo} alt="Spattoo" style={{ height: 28 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#9BB5A2', letterSpacing: 1.5, textTransform: 'uppercase' }}>Admin</span>
      </a>
    </div>
  );
}

function Router() {
  const path = window.location.pathname;
  const Screen = ROUTES[path];

  if (Screen) {
    const extraProps = {};

    if (path === '/templates/create') {
      extraProps.onSave = async ({ name, tierCount, designJson, thumbnailBlob }) => {
        let thumbnailKey = null;
        if (thumbnailBlob) {
          const filename = `${crypto.randomUUID()}.png`;
          const { url, key } = await getSignedUploadUrl('templates/thumbnails', filename, 'image/png');
          await uploadToR2(url, thumbnailBlob);
          thumbnailKey = key;
        }
        await createTemplate({
          name,
          tier_count:   tierCount,
          design:       designJson,
          thumbnail_url: thumbnailKey,
        });
      };
    }

    return (
      <>
        <AppHeader />
        <Suspense fallback={FALLBACK}>
          <Screen supabase={supabase} {...extraProps} />
        </Suspense>
      </>
    );
  }

  // Home dashboard
  return (
    <div style={{ minHeight: '100vh', background: '#EDEAE2', fontFamily: 'Quicksand, sans-serif' }}>
      <AppHeader />
      <div style={{ padding: 40 }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: 0, maxWidth: 320 }}>
          {[
            { href: '/templates',         label: 'Manage Templates' },
            { href: '/templates/design',  label: 'Design Template' },
            { href: '/elements/add',      label: 'Add Element' },
            { href: '/elements/generate', label: 'Generate Shape' },
            { href: '/elements/types',    label: 'Element Types' },
            { href: '/bakers/onboard',    label: 'Onboard Baker' },
            { href: '/patterns/build',    label: 'Pattern Builder' },
          ].map(({ href, label }) => (
            <li key={href}>
              <a href={href} style={{ display: 'block', padding: '14px 20px', background: '#fff', borderRadius: 12, border: '1.5px solid #C5D4C8', color: '#2C4433', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return FALLBACK;
  if (!session) return <Login />;
  return <Router />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
