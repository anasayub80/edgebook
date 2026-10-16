import http from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const directory = option('--dir', '.');
if (!['.', 'dist'].includes(directory)) throw new Error('--dir must be . or dist');
const root = path.resolve(projectRoot, directory);
const port = Number(option('--port', process.env.PORT || '5173'));
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid server port');
const host = option('--host', '127.0.0.1');
const liveReload = args.includes('--watch') && directory === '.';
const clients = new Set();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
const reloadScript = `<script>new EventSource('/__edgebook/events').onmessage=()=>location.reload();</script>`;

const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (liveReload && pathname === '/__edgebook/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(': connected\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    if (pathname.includes('\0') || pathname.split('/').some(segment => segment.startsWith('.'))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const resolved = path.resolve(root, relative);
    if (!resolved.startsWith(root + path.sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    let filename = resolved;
    if (directory === '.') {
      // Serve the entry point, authored modules, and public assets only.
      filename = relative === 'index.html' || relative.startsWith('src/')
        ? resolved
        : path.resolve(root, 'public', relative);
    }
    if (!(await stat(filename)).isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    let content = await readFile(filename);
    const extension = path.extname(filename);
    if (liveReload && extension === '.html') content = Buffer.from(content.toString().replace('</body>', reloadScript + '</body>'));
    response.writeHead(200, { 'Content-Type': mime[extension] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 400, { 'Content-Type': 'text/plain' });
    response.end(error.code === 'ENOENT' ? 'Not found' : 'Bad request');
  }
});

let timer;
const watchers = [];
if (liveReload) {
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { for (const client of clients) client.write('data: reload\n\n'); }, 100);
  };
  for (const folder of ['src', 'public']) watchers.push(watch(path.join(root, folder), { recursive: true }, notify));
  watchers.push(watch(path.join(root, 'index.html'), notify));
}
server.listen(port, host, () => console.log(`Edgebook ${directory === 'dist' ? 'build preview' : 'development'}: http://${host}:${server.address().port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
function stop() {
  for (const watcher of watchers) watcher.close();
  for (const client of clients) client.end();
  server.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
