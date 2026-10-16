import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(filename));
    else if (/\.(mjs|js)$/.test(filename)) files.push(filename);
  }
  return files;
}

let checked = 0;
for (const directory of ['src', 'scripts', 'tests']) {
  for (const filename of await filesIn(path.join(root, directory))) {
    const check = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
    if (check.status !== 0) throw new Error(check.stderr || `Syntax check failed: ${filename}`);
    const source = await readFile(filename, 'utf8');
    // Check every static relative import/re-export in this dependency-free app.
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      const imported = path.resolve(path.dirname(filename), match[1]);
      if (!(await stat(imported)).isFile()) throw new Error(`Missing import: ${match[1]} in ${filename}`);
    }
    checked++;
  }
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const required of ['/src/main.js', '/src/styles/app.css', '/favicon.svg']) {
  if (!html.includes(required)) throw new Error(`Missing HTML asset reference: ${required}`);
}
console.log(`Checked ${checked} JavaScript files, module paths, and HTML entry points.`);
