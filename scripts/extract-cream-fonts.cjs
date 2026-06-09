// Regenerate src/admin/creamFonts.json from public-domain single-line SVG fonts.
// Usage:  npm i -D hersheytext@2.0.0  &&  node scripts/extract-cream-fonts.cjs "$PWD"  &&  npm uninstall hersheytext
// Edit the PICK list below to add/remove faces. Glyph paths (M/L/C/Z, beziers flattened)
// become y-up polyline strokes the cream-pen tube sweep consumes directly.
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const dir = path.join(ROOT, 'node_modules/hersheytext/svg_fonts/');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

const PICK = [
  ['ems_allure',        'Allure',      'script'],
  ['ems_felix',         'Felix',       'script'],
  ['ems_elfin',         'Elfin',       'script'],
  ['ems_nixish',        'Nixish',      'hand'],
  ['ems_nixish_italic', 'Nixish It.',  'hand'],
  ['ems_osmotron',      'Osmotron',    'round'],
  ['ems_readability',   'Clean',       'print'],
  ['ems_tech',          'Tech',        'print'],
  ['hershey_script_1',  'Cursive',     'script'],
  ['hershey_script_med','Cursive Md',  'script'],
  ['hershey_goth_english','Gothic',    'fancy'],
  ['hershey_serif_med', 'Serif',       'print'],
];

const ENT = { '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" };
const decode = s => s.replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, m => ENT[m]);

function pathToStrokes(d, seg = 6) {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const strokes = []; let i = 0, cmd = null, px = 0, py = 0, cur = null, start = null;
  const isCmd = t => /^[A-Za-z]$/.test(t), n = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    if (isCmd(toks[i])) { cmd = toks[i].toUpperCase(); i++; }
    if (cmd === 'Z') { if (cur && start) cur.push([start[0], start[1]]); cur = null; cmd = null; continue; }
    if (cmd === 'M') { const x = n(), y = n(); px = x; py = y; start = [x, y]; cur = [[x, y]]; strokes.push(cur); cmd = 'L'; }
    else if (cmd === 'L') { const x = n(), y = n(); px = x; py = y; cur.push([x, y]); }
    else if (cmd === 'C') {
      const x1=n(),y1=n(),x2=n(),y2=n(),x=n(),y=n();
      for (let s=1;s<=seg;s++){ const u=s/seg, m=1-u;
        cur.push([ m*m*m*px+3*m*m*u*x1+3*m*u*u*x2+u*u*u*x, m*m*m*py+3*m*m*u*y1+3*m*u*u*y2+u*u*u*y ]); }
      px=x; py=y;
    } else { i++; }
  }
  return strokes.map(s => s.map(([x,y]) => [Math.round(x), Math.round(y)])
    .filter((p,j,a)=> j===0 || p[0]!==a[j-1][0] || p[1]!==a[j-1][1])).filter(s => s.length);
}

const out = {};
for (const [key, label, group] of PICK) {
  const svg = fs.readFileSync(path.join(dir, index[key].file), 'utf8');
  const face = svg.match(/<font-face[^>]*>/)[0];
  const upm = parseFloat((face.match(/units-per-em="([^"]+)"/) || [])[1] || 1000);
  const fontEl = svg.match(/<font[^>]*>/)[0];
  const defAdv = parseFloat((fontEl.match(/horiz-adv-x="([^"]+)"/) || [])[1] || upm/2);
  const glyphs = {}; let space = defAdv;
  for (const m of svg.matchAll(/<glyph\b([^>]*?)\/?>/g)) {
    const attrs = m[1];
    const uMatch = attrs.match(/unicode="([^"]*)"/); if (!uMatch) continue;
    const ch = decode(uMatch[1]); if (ch.length !== 1) continue;
    const code = ch.charCodeAt(0); if (code < 32 || code > 126) continue;
    const adv = parseFloat((attrs.match(/horiz-adv-x="([^"]+)"/) || [])[1] || defAdv);
    if (ch === ' ') { space = adv; continue; }
    const dm = attrs.match(/\sd="([^"]*)"/); if (!dm) continue;
    const strokes = pathToStrokes(dm[1]); if (!strokes.length) continue;
    glyphs[ch] = { a: Math.round(adv), s: strokes };
  }
  out[key] = { name: label, group, em: Math.round(upm), space: Math.round(space), glyphs };
}
fs.writeFileSync(path.join(ROOT, 'src/admin/creamFonts.json'), JSON.stringify(out));
console.log('wrote src/admin/creamFonts.json', (fs.statSync(path.join(ROOT,'src/admin/creamFonts.json')).size/1024).toFixed(0)+'K');
for (const k of Object.keys(out)) console.log('  ', k.padEnd(22), out[k].name.padEnd(12), 'glyphs='+Object.keys(out[k].glyphs).length, 'em='+out[k].em, 'space='+out[k].space);
