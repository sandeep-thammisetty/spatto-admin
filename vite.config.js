import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Dev-only: accept a POSTed PNG data URL from the Texture Calibrator's "Save snapshot" and write it
// into .snapshots/ in the project (which tooling can read — unlike ~/Downloads, which macOS blocks).
function snapshotSaver() {
  return {
    name: 'snapshot-saver',
    configureServer(server) {
      server.middlewares.use('/__snapshot', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const data = String(body).replace(/^data:image\/png;base64,/, '');
            const dir = path.resolve(process.cwd(), 'snapshots');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'rustic-snapshot.png'), Buffer.from(data, 'base64'));
            res.statusCode = 200; res.end('ok');
          } catch (e) {
            res.statusCode = 500; res.end(String(e?.message || e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), snapshotSaver()],
  server: { port: 5174 },
  appType: 'spa',
  resolve: {
    alias: {
      '@spattoo/designer': '/users/sandeep/dev/spattoo-core/src/index.js',
    },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  },
});
