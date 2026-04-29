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

const ROUTES = {
  '/templates/create': CreateTemplate,
  '/templates/design': DesignTemplate,
  '/templates':        ManageTemplates,
  '/elements/add':     AddElement,
  '/bakers/onboard':   OnboardBaker,
};

const FALLBACK = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9b5f72' }}>
    Loading…
  </div>
);

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
      <Suspense fallback={FALLBACK}>
        <Screen supabase={supabase} {...extraProps} />
      </Suspense>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EDEAE2', fontFamily: 'Quicksand, sans-serif' }}>
      <div style={{ padding: '24px 40px', background: '#fff', borderBottom: '1.5px solid #C5D4C8', display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src={logo} alt="Spattoo" style={{ height: 36 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6B8C74', letterSpacing: 1, textTransform: 'uppercase' }}>Admin</span>
      </div>
      <div style={{ padding: 40 }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: 0, maxWidth: 320 }}>
          <li>
            <a href="/templates" style={{ display: 'block', padding: '14px 20px', background: '#fff', borderRadius: 12, border: '1.5px solid #C5D4C8', color: '#2C4433', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
              Manage Templates
            </a>
          </li>
          <li>
            <a href="/templates/design" style={{ display: 'block', padding: '14px 20px', background: '#fff', borderRadius: 12, border: '1.5px solid #C5D4C8', color: '#2C4433', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
              Design Template
            </a>
          </li>
          <li>
            <a href="/elements/add" style={{ display: 'block', padding: '14px 20px', background: '#fff', borderRadius: 12, border: '1.5px solid #C5D4C8', color: '#2C4433', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
              Add Element
            </a>
          </li>
          <li>
            <a href="/bakers/onboard" style={{ display: 'block', padding: '14px 20px', background: '#fff', borderRadius: 12, border: '1.5px solid #C5D4C8', color: '#2C4433', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
              Onboard Baker
            </a>
          </li>
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
