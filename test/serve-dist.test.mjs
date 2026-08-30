import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../build-lib.mjs';

function startVerificationServer({ distDir } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['test/serve-dist.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, AWT_VERIFY_PORT: '0', ...(distDir ? { AWT_DIST_DIR: distDir } : {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Verification server did not start: ${output}`));
    }, 5_000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Serving .* at (http:\/\/127\.0\.0\.1:(\d+))/);
      if (match) {
        clearTimeout(timeout);
        resolve({ child, origin: match[1] });
      }
    });
    child.stderr.on('data', chunk => {
      output += chunk;
    });
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Verification server exited with ${code}: ${output}`));
    });
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function request(origin, path, { method = 'GET', body } = {}) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const clientRequest = http.request({
      hostname: url.hostname,
      port: url.port,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
    }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        responseBody += chunk;
      });
      response.once('end', () => resolve({ response, body: responseBody }));
    });
    clientRequest.once('error', reject);
    clientRequest.end(body);
  });
}

test('verification server rejects decoded traversal paths', async t => {
  const server = await startVerificationServer();
  t.after(() => server.child.kill());

  const { response } = await request(server.origin, '/%2e%2e/index.html');

  assert.equal(response.statusCode, 400);
});

test('verification success endpoint returns a delayed local JSON response', async t => {
  const server = await startVerificationServer();
  t.after(() => server.child.kill());

  const { response, body } = await request(server.origin, '/__verify/enquiry-success', {
    method: 'POST',
    body: '{"name":"Local test"}'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(body), { ok: true, simulation: 'success' });
});

test('verification HTTP-error endpoint returns a local non-2xx response', async t => {
  const server = await startVerificationServer();
  t.after(() => server.child.kill());

  const { response, body } = await request(server.origin, '/__verify/enquiry-http-error', {
    method: 'POST',
    body: '{}'
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(JSON.parse(body), { ok: false, simulation: 'http-error' });
});

test('verification network-error endpoint closes the local connection', async t => {
  const server = await startVerificationServer();
  t.after(() => server.child.kill());

  await assert.rejects(
    request(server.origin, '/__verify/enquiry-network-error', { method: 'POST', body: '{}' }),
    /socket hang up|ECONNRESET/
  );
});

test('clean-route server matches generated production routes, redirects, assets, and 404s', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-serve-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const server = await startVerificationServer({ distDir: outDir });
  t.after(() => server.child.kill());

  const canonical = await request(server.origin, '/collection/bags/amira-tote');
  assert.equal(canonical.response.statusCode, 200);
  assert.match(canonical.body, /rel="canonical" href="https:\/\/beads\.alwintru\.com\/collection\/bags\/amira-tote"/);

  const asset = await request(server.origin, '/enquiry.js');
  assert.equal(asset.response.statusCode, 200);
  assert.equal(asset.response.headers['content-type'], 'text/javascript; charset=utf-8');

  const legacy = await request(server.origin, '/collection/table-textiles');
  assert.equal(legacy.response.statusCode, 301);
  assert.equal(legacy.response.headers.location, '/collection/table-runners');

  const unknown = await request(server.origin, '/no-such-route');
  assert.equal(unknown.response.statusCode, 404);
  assert.equal(unknown.response.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(unknown.body, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(unknown.body, /<h1>Page not found<\/h1>/);
});
