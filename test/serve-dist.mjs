import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = resolve(ROOT_DIR, 'dist');
const HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const VERIFICATION_RESPONSE_DELAY_MS = 500;

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon']
]);

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(message);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function handleVerificationEndpoint(request, response) {
  const requestPath = request.url.split('?', 1)[0];
  const simulations = new Map([
    ['/__verify/enquiry-success', { statusCode: 200, payload: { ok: true, simulation: 'success' } }],
    ['/__verify/enquiry-http-error', { statusCode: 503, payload: { ok: false, simulation: 'http-error' } }]
  ]);

  if (!simulations.has(requestPath) && requestPath !== '/__verify/enquiry-network-error') return false;
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendText(response, 405, 'Method not allowed');
    return true;
  }

  request.resume();
  if (requestPath === '/__verify/enquiry-network-error') {
    setTimeout(() => request.socket.destroy(), VERIFICATION_RESPONSE_DELAY_MS);
    return true;
  }

  const simulation = simulations.get(requestPath);
  setTimeout(
    () => sendJson(response, simulation.statusCode, simulation.payload),
    VERIFICATION_RESPONSE_DELAY_MS
  );
  return true;
}

function resolveRequestPath(requestUrl) {
  const queryIndex = requestUrl.indexOf('?');
  const rawPathname = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex);
  const pathname = decodeURIComponent(rawPathname);

  if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0')) {
    return null;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = extname(relativePath) ? relativePath : `${relativePath}.html`;
  const absolutePath = resolve(DIST_DIR, candidate);

  if (absolutePath !== DIST_DIR && !absolutePath.startsWith(`${DIST_DIR}${sep}`)) {
    return null;
  }

  return absolutePath;
}

export function createDistServer() {
  return createServer(async (request, response) => {
    if (handleVerificationEndpoint(request, response)) return;

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      sendText(response, 405, 'Method not allowed');
      return;
    }

    let absolutePath;
    try {
      absolutePath = resolveRequestPath(request.url);
    } catch (error) {
      if (error instanceof URIError) {
        sendText(response, 400, 'Bad request');
        return;
      }
      throw error;
    }

    if (!absolutePath) {
      sendText(response, 400, 'Bad request');
      return;
    }

    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        sendText(response, 404, 'Not found');
        return;
      }

      const body = request.method === 'HEAD' ? null : await readFile(absolutePath);
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES.get(extname(absolutePath).toLowerCase()) || 'application/octet-stream',
        'Content-Length': fileStat.size,
        'Cache-Control': 'no-store'
      });
      response.end(body);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        sendText(response, 404, 'Not found');
        return;
      }
      console.error(error);
      sendText(response, 500, 'Internal server error');
    }
  });
}

const requestedPort = Number.parseInt(process.env.AWT_VERIFY_PORT || `${DEFAULT_PORT}`, 10);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65_535) {
  throw new Error('AWT_VERIFY_PORT must be an integer from 0 to 65535');
}

const server = createDistServer();
server.listen(requestedPort, HOST, () => {
  const address = server.address();
  console.log(`Serving ${DIST_DIR} at http://${HOST}:${address.port}`);
});
