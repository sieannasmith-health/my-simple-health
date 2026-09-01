import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import helloHandler from './api/hello.js';
import exploreHandler from './api/explore.js';
import foodProductHandler from './api/food-product.js';
import foodReceiptHandler from './api/food-receipt.js';

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
  try {
    const apiHandlers = {
      '/api/hello': helloHandler,
      '/api/explore': exploreHandler,
      '/api/food-product': foodProductHandler,
      '/api/food-receipt': foodReceiptHandler
    };
    const handler = apiHandlers[url.pathname];
    if (handler) {
      const bodyLimit = url.pathname === '/api/food-receipt' ? 13_000_000 : 1_000_000;
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

const port = Number(process.env.PORT) || 43127;
server.listen(port, '127.0.0.1', () => {
  console.log(`[dev] My Simple Health: http://127.0.0.1:${port}`);
  console.log(`[dev] API runtimes: /api/hello, /api/explore, /api/food-product, /api/food-receipt`);
  console.log(`[dev] OPENAI_API_KEY detected: ${Boolean(process.env.OPENAI_API_KEY) ? 'yes' : 'no'}`);
  console.log(`[dev] HELLO_MODEL: ${process.env.HELLO_MODEL || 'gpt-5.6-luna'}`);
});
