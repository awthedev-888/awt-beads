import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('README documents the production architecture', async () => {
  const readme = await readFile('README.md', 'utf8');
  for (const required of ['node build.mjs', 'dist/', 'catalogue.json', '/privacy', 'sitemap.xml', 'Formspree', 'node --test']) {
    assert.ok(readme.includes(required), required);
  }
  assert.doesNotMatch(readme, /no build step/i);
});
