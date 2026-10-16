import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');

// This project uses browser-native ES modules. Preserve module paths and copy
// authored sources rather than introducing a compiler or runtime dependency.
await readFile(path.join(root, 'src/main.js'), 'utf8');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(output, 'index.html'));
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
console.log('Built Edgebook in dist/. Run npm run preview to serve it.');
