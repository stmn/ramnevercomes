// Build step for deploy: minifies JS/CSS and compacts lang JSONs into dist/.
// Sources in js/, css/, lang/ stay readable — only dist/ ships to nginx.
// Top-level function names survive minification (inline onclick handlers rely
// on them); local identifiers, whitespace and comments do not.
import { buildSync } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
for (const d of ['css', 'js', 'lang']) fs.mkdirSync(path.join(out, d), { recursive: true });

const kb = f => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
const report = [];

for (const f of ['js/app.js', 'js/data.js', 'js/icons.js', 'sw.js', 'css/styles.css']) {
  buildSync({
    entryPoints: [f],
    minify: true,
    target: ['es2020'],
    charset: 'utf8',
    legalComments: 'none',
    outfile: path.join(out, f),
  });
  report.push(`${f}: ${kb(f)} -> ${kb(path.join(out, f))}`);
}

for (const f of fs.readdirSync('lang')) {
  const src = path.join('lang', f);
  const dst = path.join(out, 'lang', f);
  fs.writeFileSync(dst, JSON.stringify(JSON.parse(fs.readFileSync(src, 'utf8'))));
  report.push(`${src}: ${kb(src)} -> ${kb(dst)}`);
}

for (const f of ['index.html', 'manifest.json']) fs.copyFileSync(f, path.join(out, f));

console.log(report.join('\n'));
console.log('dist/ ready');
