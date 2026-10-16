import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
async function runBuild() {
  const child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'pipe' });
  let output = '';
  child.stderr.on('data', data => { output += data; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, output);
}
async function startServer(directory) {
  const child = spawn(process.execPath, ['scripts/serve.mjs', '--dir', directory, '--port', '0'], { cwd: root, stdio: 'pipe' });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Server startup timed out')); }, 5000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stderr.on('data', data => { clearTimeout(timer); child.kill(); reject(new Error(String(data))); });
    child.stdout.on('data', data => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited early (${code})`)); });
  });
  return { child, url };
}
async function sourceFiles(directory = 'src') {
  const out = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await sourceFiles(name));
    else out.push(name);
  }
  return out;
}

test('editable source and generated build serve every module and asset', async () => {
  await runBuild();
  const files = await sourceFiles();
  for (const directory of ['.', 'dist']) {
    const { child, url } = await startServer(directory);
    try {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /\/src\/main\.js/);
      assert.match(html, /\/src\/styles\/app\.css/);
      for (const file of [...files, 'favicon.svg']) {
        const result = await fetch(`${url}/${file}`);
        assert.equal(result.status, 200, `${directory}: ${file}`);
        if (file.endsWith('.js')) assert.match(result.headers.get('content-type'), /javascript/);
        await result.arrayBuffer();
      }
      const head = await fetch(url + '/src/main.js', { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      const missing = await fetch(url + '/missing.js');
      assert.equal(missing.status, 404);
      await missing.text();
      const internal = await fetch(url + '/.openai/hosting.json');
      assert.equal(internal.status, 403);
      await internal.text();
    } finally {
      const exit = once(child, 'exit');
      child.kill('SIGTERM');
      await exit;
    }
  }
});
