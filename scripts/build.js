const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'script.js'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Required static file is missing: ${file}`);
  }
  fs.copyFileSync(source, path.join(output, file));
}

require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, 'netlify-auth.mjs')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  outfile: path.join(output, 'script.js'),
});

console.log(`Prepared static site in ${output}`);
