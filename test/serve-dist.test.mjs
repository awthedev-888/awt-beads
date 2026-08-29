import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';

function startVerificationServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['test/serve-dist.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, AWT_VERIFY_PORT: '0' },
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
