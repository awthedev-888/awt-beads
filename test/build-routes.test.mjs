import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildSite, outputFileForPath } from '../build-lib.mjs';
import { PRIMARY_ROUTES, allIndexableRoutes, categoryPath, productPath } from '../site-routes.mjs';

async function loadRuntimeComponent() {
  const [html, rawCatalogue] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('catalogue.json', 'utf8')
  ]);
  const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(script, 'runtime component script');
  const catalogue = JSON.parse(rawCatalogue);
  const routeData = allIndexableRoutes(catalogue)
    .map(({ category, product, ...route }) => route);
  const markers = new Map([
    ['awt-catalogue', JSON.stringify(catalogue)],
    ['awt-route-data', JSON.stringify(routeData)]
  ]);
  const sandbox = {
    DCLogic: class {},
    document: { getElementById: id => ({ textContent: markers.get(id) || '' }) }
  };
  runInNewContext(`${script[1]}\nglobalThis.Component = Component;`, sandbox);
  const component = new sandbox.Component();
  component.props = {};
  return { component, html };
}

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

test('category HTML uses the authoritative category image alt text', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'collection/bags.html'), 'utf8');
  assert.match(html, /property="og:image:alt" content="Amira beaded tote on limestone in soft morning light"/);
  assert.match(html, /name="twitter:image:alt" content="Amira beaded tote on limestone in soft morning light"/);
});

test('build generates a duplicate-free sitemap from active manifest routes', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const manifest = await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const sitemap = await readFile(join(outDir, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);

  assert.equal(urls.length, new Set(urls).size);
  assert.equal(urls.length, manifest.routes.length);
  assert.ok(urls.includes('https://beads.alwintru.com/privacy'));
  assert.ok(urls.includes('https://beads.alwintru.com/collection/bags/amira-tote'));
  assert.ok(!urls.some(url => url.includes('mahulu-woven-rattan-cuff-set')));
});

test('product and category pages contain truthful route structured data', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const [productHtml, categoryHtml] = await Promise.all([
    readFile(join(outDir, 'collection/bags/amira-tote.html'), 'utf8'),
    readFile(join(outDir, 'collection/bags.html'), 'utf8')
  ]);
  const productJson = JSON.parse(productHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const categoryJson = JSON.parse(categoryHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const product = productJson['@graph'].find(item => item['@type'] === 'Product');
  const collection = categoryJson['@graph'].find(item => item['@type'] === 'CollectionPage');

  assert.match(productHtml, /"@type":"Product"/);
  assert.match(productHtml, /"@type":"BreadcrumbList"/);
  assert.equal(product.name, 'Amira Tote');
  assert.equal(product.description, 'The largest bag in the line, beaded edge to edge on a black ground. The piece shown pairs mirrored white figures and lime forms with yellow curls and a strong magenta centre line, finished with twin black beaded handles and a zip top.');
  assert.equal(product.image, 'https://beads.alwintru.com/images/bags/amira-styled.jpg');
  assert.equal(product.productID, 'amira');
  assert.equal(product.material, 'Glass seed beads, hand-strung; twin beaded rope handles; zip closure');
  assert.equal(product.category, 'Bags');
  assert.equal(product.additionalProperty[0].value, 'Kampung Manik, Samarinda, East Kalimantan, Indonesia');
  assert.doesNotMatch(productHtml, /"offers"|"aggregateRating"|"gtin"/);
  assert.doesNotMatch(productHtml, /"@type":"WebPage"/);
  assert.match(categoryHtml, /"@type":"CollectionPage"/);
  assert.match(categoryHtml, /"@type":"BreadcrumbList"/);
  assert.equal(collection.name, 'Bags');
  assert.equal(collection.description, 'Hand-beaded bags, pouches and woven rattan crossbodies.');
});

test('fallback HTML uses route headings, descriptions, product facts, and active category links', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const [collectionHtml, categoryHtml, productHtml] = await Promise.all([
    readFile(join(outDir, 'collection.html'), 'utf8'),
    readFile(join(outDir, 'collection/bags.html'), 'utf8'),
    readFile(join(outDir, 'collection/bags/amira-tote.html'), 'utf8')
  ]);

  assert.match(collectionHtml, /<h1[^>]*>Hand-beaded pieces for contemporary retail<\/h1>/);
  assert.match(collectionHtml, /Explore hand-beaded bags, jewellery, décor, beaded table runners and small accessories from Kampung Manik, Samarinda\./);
  assert.doesNotMatch(collectionHtml, /Explore 56 hand-beaded/);
  assert.match(categoryHtml, /<h1[^>]*>Bags<\/h1>/);
  assert.match(categoryHtml, /Hand-beaded bags, pouches and woven rattan crossbodies\./);
  assert.match(categoryHtml, /href="\/collection\/bags\/amira-tote"/);
  assert.match(productHtml, /<h1[^>]*>Amira Tote<\/h1>/);
  assert.match(productHtml, /<dt>Materials<\/dt><dd>Glass seed beads, hand-strung; twin beaded rope handles; zip closure<\/dd>/);
  assert.match(productHtml, /<dt>Production location<\/dt><dd>Kampung Manik, Samarinda, East Kalimantan, Indonesia<\/dd>/);
  assert.match(productHtml, /Contemporary Borneo beadwork\./);
  assert.match(productHtml, /href="\/wholesale#wholesale-enquiry"/);
});

test('all generated structured data and fallback fragments avoid legacy line-sheet copy', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const manifest = await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const offenders = [];

  for (const route of manifest.routes) {
    const html = await readFile(route.output, 'utf8');
    const structuredData = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
    assert.ok(structuredData, `${route.path}: structured data`);
    assert.ok(fallback, `${route.path}: fallback`);
    if (/\bline[ -]?sheet\b/i.test(`${structuredData[1]}\n${fallback[1]}`)) offenders.push(route.path);
  }

  assert.deepEqual(offenders, []);
});

test('generated sitemap redirects legacy routes before the SPA fallback', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const redirects = await readFile(join(outDir, '_redirects'), 'utf8');
  const rules = redirects.split('\n').filter(line => line.startsWith('/'));

  assert.ok(rules.includes('/collection/table-textiles  /collection/table-runners  301'));
  assert.ok(rules.includes('/collection/table-textiles/*  /collection/table-runners/:splat  301'));
  assert.ok(rules.includes('/collection/table-textiles/manik-coaster-set-6  /collection/coasters  301'));
  assert.ok(rules.includes('/collection/jewelry/golden-sun-hoop-earrings  /collection/earrings/golden-sun-hoop-earrings  301'));
  assert.ok(!rules.some(rule => rule.startsWith('/collection/jewelry/*')));
  assert.equal(rules.at(-1), '/*  /index.html  200');
});

test('runtime routes resolve canonical table-runner category and product deep links', async () => {
  const { component } = await loadRuntimeComponent();
  const category = component.collectionStateFromPath('/collection/table-runners');
  const product = component.collectionStateFromPath('/collection/table-runners/emerald-mirror-borneo-beaded-table-runner');
  const legacy = component.collectionStateFromPath('/collection/table-textiles');

  assert.equal(component.categoryPath('Table textiles'), '/collection/table-runners');
  assert.deepEqual({ cat: category.cat, product: category.product }, { cat: 'Table textiles', product: null });
  assert.deepEqual({ cat: product.cat, product: product.product && product.product.id }, { cat: 'Table textiles', product: 'table-runner-emerald-mirror' });
  assert.deepEqual({ cat: legacy.cat, product: legacy.product }, { cat: 'Table textiles', product: null });
});

test('privacy has a static and runtime-visible minimum data-use contract', async t => {
  const { component, html: source } = await loadRuntimeComponent();
  component.state = { ...component.state, page: 'privacy' };
  assert.equal(component.renderVals().isPrivacy, true);

  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'privacy.html'), 'utf8');
  assert.match(source, /<sc-if value="\{\{ isPrivacy \}\}"/);
  assert.match(html, /<h1[^>]*>Privacy<\/h1>/);
  assert.match(html, /beads@alwintru\.com/);
  assert.match(html, /Enquiry data is used to respond\./);
});
