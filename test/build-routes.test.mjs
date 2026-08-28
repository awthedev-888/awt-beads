import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, outputFileForPath } from '../build-lib.mjs';
import { PRIMARY_ROUTES, allIndexableRoutes, categoryPath, productPath } from '../site-routes.mjs';

test('route helpers produce flat canonical collection paths', () => {
  const catalogue = {
    categories: [{ id: 'bags', name: 'Bags', slug: 'bags', image: '/bags.jpg', description: 'Bags.' }],
    products: [
      { id: 'active', name: 'Active bag', slug: 'active-bag', categoryId: 'bags', status: 'active', image: '/active.jpg', description: 'Active.' },
      { id: 'archived', name: 'Archived bag', slug: 'archived-bag', categoryId: 'bags', status: 'archived', image: '/archived.jpg', description: 'Archived.' }
    ]
  };

  assert.equal(categoryPath(catalogue.categories[0]), '/collection/bags');
  assert.equal(productPath(catalogue.products[0], catalogue), '/collection/bags/active-bag');
  assert.ok(PRIMARY_ROUTES.some(route => route.path === '/privacy'));
  assert.deepEqual(
    allIndexableRoutes(catalogue).filter(route => route.kind === 'product').map(route => route.path),
    ['/collection/bags/active-bag']
  );
  assert.equal(outputFileForPath('/tmp/site', '/collection/bags'), '/tmp/site/collection/bags.html');
});

test('productPath rejects a product with an unknown category', () => {
  assert.throws(
    () => productPath({ id: 'orphan', categoryId: 'missing', slug: 'orphan' }, { categories: [] }),
    /Unknown category missing for orphan/
  );
});

test('build emits primary, category, and active product routes', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const manifest = await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const paths = new Set(manifest.routes.map(x => x.path));
  for (const path of ['/', '/collection', '/motifs', '/wholesale', '/our-makers', '/contact', '/privacy', '/collection/bags', '/collection/bags/amira-tote']) {
    assert.ok(paths.has(path), path);
  }
  assert.ok(![...paths].some(path => path.includes('mahulu-woven-rattan-cuff-set')));
});

test('product HTML contains static route metadata and catalogue JSON', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'collection/bags/amira-tote.html'), 'utf8');
  assert.match(html, /<title>Amira Tote \| Alana Wina Trudi<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/beads\.alwintru\.com\/collection\/bags\/amira-tote"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /id="awt-catalogue"/);
});
