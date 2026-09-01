import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import helloHandler from './api/hello.js';
import exploreHandler from './api/explore.js';
import foodProductHandler from './api/food-product.js';
import foodReceiptHandler from './api/food-receipt.js';
import foodProductMatchHandler from './api/food-product-match.js';
import foodDateLabelHandler from './api/food-date-label.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));

async function loadLocalEnvironment() {
  for (const filename of ['.env.local', '.env']) {
    try {
      const source = await readFile(resolve(root, filename), 'utf8');
      source.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || match[0].trimStart().startsWith('#') || process.env[match[1]] !== undefined) return;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        process.env[match[1]] = value;
      });
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

await loadLocalEnvironment();

const mime = {
  '.css':'text/css; charset=utf-8', '.html':'text/html; charset=utf-8', '.ico':'image/x-icon',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.png':'image/png', '.svg':'image/svg+xml; charset=utf-8', '.webp':'image/webp'
};
const publicDirectories = new Set(['assets', 'css', 'data', 'js']);
const publicRootExtensions = new Set(['.css', '.html', '.ico', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const publicRootFiles = new Set(['youtube-config.json']);

function isPublicStaticPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length || parts.some(part => part.startsWith('.'))) return pathname === '/';
  if (parts.length === 1) {
    return publicRootFiles.has(parts[0]) || publicRootExtensions.has(extname(parts[0]).toLowerCase());
  }
  return publicDirectories.has(parts[0]) && Boolean(mime[extname(parts.at(-1)).toLowerCase()]);
}

function apiResponse(response) {
  let statusCode = 200;
  const headers = {};
  return {
    setHeader(name, value) { headers[name] = value; response.setHeader(name, value); },
    status(code) { statusCode = code; return this; },
    json(value) { response.writeHead(statusCode, { 'Content-Type':'application/json; charset=utf-8', ...headers }); response.end(JSON.stringify(value)); },
    end(value = '') { response.writeHead(statusCode, headers); response.end(value); }
  };
}

async function parseJson(request, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  if (!isPublicStaticPath(pathname)) return false;
  const file = resolve(root, `.${decodeURIComponent(requested)}`);
  if (file !== root && !file.startsWith(root + sep)) return false;
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    response.writeHead(200, { 'Content-Type':mime[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' });
    response.end(await readFile(file));
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[dev] Static file error:', error.message);
    return false;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (host === '0.0.0.0' || host === '::') {
    console.log(`[dev] Request: ${request.method || 'GET'} ${url.pathname} from ${request.socket.remoteAddress || 'unknown'}`);
  }
  try {
    const apiHandlers = {
      '/api/hello': helloHandler,
      '/api/explore': exploreHandler,
      '/api/food-product': foodProductHandler,
      '/api/food-receipt': foodReceiptHandler,
      '/api/food-product-match': foodProductMatchHandler,
      '/api/food-date-label': foodDateLabelHandler
    };
    const handler = apiHandlers[url.pathname];
    if (handler) {
      const bodyLimit = ['/api/food-receipt','/api/food-date-label'].includes(url.pathname) ? 13_000_000 : 1_000_000;
      request.body = request.method === 'POST' ? await parseJson(request, bodyLimit) : {};
      await handler(request, apiResponse(response));
      return;
    }
    if (await serveStatic(url.pathname, response)) return;
    response.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
    response.end('Not found');
  } catch (error) {
    console.error('[dev] Request error:', error && error.message ? error.message : 'UNKNOWN_ERROR');
    if (!response.headersSent) response.writeHead(error.message === 'REQUEST_TOO_LARGE' ? 413 : 500, { 'Content-Type':'application/json; charset=utf-8' });
    response.end(JSON.stringify({ success:false, message:'The local development server could not process this request.' }));
  }
});

const host = process.env.MSH_DEV_HOST || process.env.HOST || '127.0.0.1';
const port = Number(process.env.MSH_DEV_PORT || process.env.PORT) || 43127;

function lanIPv4Addresses() {
  return Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) => (addresses || []).map(address => ({ name, ...address })))
    .filter(address => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'))
    .sort((left, right) => Number(right.name === 'en0') - Number(left.name === 'en0') || left.name.localeCompare(right.name))
    .map(address => address.address);
}

server.on('error', error => {
  console.error(`[dev] Server failed on ${host}:${port}:`, error.message);
});

server.listen(port, host, () => {
  console.log(`[dev] My Simple Health: http://${host}:${port}`);
  if (host === '0.0.0.0' || host === '::') {
    const addresses = lanIPv4Addresses();
    if (addresses.length) addresses.forEach(address => console.log(`[dev] Physical device URL: http://${address}:${port}/my-health.html`));
    else console.error('[dev] Physical device URL unavailable: no LAN IPv4 address was found.');
  }
  console.log(`[dev] API runtimes: /api/hello, /api/explore, /api/food-product, /api/food-receipt, /api/food-product-match, /api/food-date-label`);
  console.log(`[dev] OPENAI_API_KEY detected: ${Boolean(process.env.OPENAI_API_KEY) ? 'yes' : 'no'}`);
  console.log(`[dev] HELLO_MODEL: ${process.env.HELLO_MODEL || 'gpt-5.6-luna'}`);
});
