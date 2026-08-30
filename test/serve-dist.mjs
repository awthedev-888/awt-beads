import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIST_DIR = resolve(ROOT_DIR, 'dist');
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

function redirectResponse(response, statusCode, location) {
  response.writeHead(statusCode, {
    Location: location,
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(`Redirecting to ${location}`);
}

async function readRedirectRules(distDir) {
  try {
    const source = await readFile(resolve(distDir, '_redirects'), 'utf8');
    return source.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const [from, to, rawStatus = '301'] = line.split(/\s+/);
        return { from, to, statusCode: Number.parseInt(rawStatus, 10) };
      })
      .filter(rule => rule.from && rule.to && [301, 302].includes(rule.statusCode));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function redirectForPath(pathname, rules) {
  for (const rule of rules) {
    const wildcard = rule.from.indexOf('*');
    if (wildcard === -1) {
      if (pathname === rule.from) return { statusCode: rule.statusCode, location: rule.to };
      continue;
    }
    const prefix = rule.from.slice(0, wildcard);
    const suffix = rule.from.slice(wildcard + 1);
    if (!pathname.startsWith(prefix) || (suffix && !pathname.endsWith(suffix))) continue;
    const splat = pathname.slice(prefix.length, suffix ? -suffix.length : undefined);
    return { statusCode: rule.statusCode, location: rule.to.replace(':splat', splat) };
  }
  return null;
}

async function sendNotFound(request, response, distDir) {
  const notFoundPath = resolve(distDir, '404.html');
  try {
    const [body, fileStat] = await Promise.all([readFile(notFoundPath), stat(notFoundPath)]);
    response.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': fileStat.size,
      'Cache-Control': 'no-store'
    });
    response.end(request.method === 'HEAD' ? null : body);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      sendText(response, 404, 'Not found');
      return;
    }
    throw error;
  }
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

function resolveRequestPath(requestUrl, distDir) {
  const queryIndex = requestUrl.indexOf('?');
  const rawPathname = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex);
  const pathname = decodeURIComponent(rawPathname);

  if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0')) {
    return null;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = extname(relativePath) ? relativePath : `${relativePath}.html`;
  const absolutePath = resolve(distDir, candidate);

  if (absolutePath !== distDir && !absolutePath.startsWith(`${distDir}${sep}`)) {
    return null;
  }

  return absolutePath;
}

export function createDistServer({ distDir = DEFAULT_DIST_DIR } = {}) {
  const resolvedDistDir = resolve(distDir);
  const redirectRules = readRedirectRules(resolvedDistDir);
  return createServer(async (request, response) => {
    if (handleVerificationEndpoint(request, response)) return;

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      sendText(response, 405, 'Method not allowed');
      return;
    }

    let absolutePath;
    try {
      const rawPathname = request.url.split('?', 1)[0];
      const pathname = decodeURIComponent(rawPathname);
      const redirect = redirectForPath(pathname, await redirectRules);
      if (redirect) {
        redirectResponse(response, redirect.statusCode, redirect.location);
        return;
      }
      absolutePath = resolveRequestPath(request.url, resolvedDistDir);
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
        await sendNotFound(request, response, resolvedDistDir);
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
        await sendNotFound(request, response, resolvedDistDir);
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

const distDir = process.env.AWT_DIST_DIR ? resolve(process.env.AWT_DIST_DIR) : DEFAULT_DIST_DIR;
const server = createDistServer({ distDir });
server.listen(requestedPort, HOST, () => {
  const address = server.address();
  console.log(`Serving ${distDir} at http://${HOST}:${address.port}`);
});
