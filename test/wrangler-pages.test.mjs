import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../build-lib.mjs';

function wranglerAvailable() {
  return new Promise(resolve => {
    const child = spawn('wrangler', ['--version'], { stdio: 'ignore' });
    child.once('error', () => resolve(false));
    child.once('exit', code => resolve(code === 0));
  });
}

function startWrangler(directory) {
  return new Promise((resolve, reject) => {
    const child = spawn('wrangler', [
      'pages', 'dev', directory,
      '--ip', '127.0.0.1',
      '--port', '0',
      '--compatibility-date', '2025-12-10',
      '--show-interactive-dev-session=false',
      '--log-level', 'info'
    ], {
      cwd: process.cwd(),
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let ready = false;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Wrangler did not start within 15 seconds:\n${output}`));
    }, 15_000);

    const capture = chunk => {
      output += chunk;
      const match = output.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/);
      if (!ready && match) {
        ready = true;
        clearTimeout(timeout);
        resolve({ child, origin: match[1], output: () => output });
      }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', error => {
      clearTimeout(timeout);
      if (!ready) reject(error);
    });
    child.once('exit', code => {
      clearTimeout(timeout);
      if (!ready) reject(new Error(`Wrangler exited with ${code}:\n${output}`));
    });
  });
}

test('Wrangler serves canonical routes, assets, legacy redirects, and a real unknown-path 404', async t => {
  if (!(await wranglerAvailable())) {
    t.skip('Wrangler is not installed');
    return;
  }

  const outDir = await mkdtemp(join(tmpdir(), 'awt-wrangler-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const server = await startWrangler(outDir);
  t.after(() => server.child.kill());

  const canonical = await fetch(`${server.origin}/collection/bags/amira-tote`, { redirect: 'manual' });
  assert.equal(canonical.status, 200);
  assert.match(await canonical.text(), /rel="canonical" href="https:\/\/beads\.alwintru\.com\/collection\/bags\/amira-tote"/);

  const asset = await fetch(`${server.origin}/enquiry.js`, { redirect: 'manual' });
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type') || '', /javascript/);

  const legacy = await fetch(`${server.origin}/collection/table-textiles`, { redirect: 'manual' });
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.get('location'), '/collection/table-runners');

  const unknown = await fetch(`${server.origin}/no-such-route`, { redirect: 'manual' });
  assert.equal(unknown.status, 404);
  assert.match(await unknown.text(), /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(server.output(), /Infinite loop detected/);
});
