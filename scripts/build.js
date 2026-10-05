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

console.log(`Prepared static site in ${output}`);
