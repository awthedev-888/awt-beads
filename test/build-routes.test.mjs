import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildSite, outputFileForPath } from '../build-lib.mjs';
import { PRIMARY_ROUTES, allIndexableRoutes, categoryPath, productPath } from '../site-routes.mjs';

async function loadRuntimeComponent({ enquiryApi, elements = new Map(), FormDataImpl = FormData, windowImpl = {}, globals = {} } = {}) {
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
  class TestLogic {
    setState(update, callback) {
      const patch = typeof update === 'function' ? update(this.state) : update;
      this.state = { ...this.state, ...patch };
      if (callback) callback();
    }
  }
  const document = {
    body: { style: {} },
    activeElement: null,
    getElementById: id => elements.get(id) || ({ textContent: markers.get(id) || '' })
  };
  const sandbox = {
    DCLogic: TestLogic,
    document,
    window: { AWTEnquiry: enquiryApi, ...windowImpl },
    FormData: FormDataImpl,
    requestAnimationFrame: callback => callback(),
    setTimeout,
    clearTimeout,
    ...globals
  };
  runInNewContext(`${script[1]}\nglobalThis.Component = Component;`, sandbox);
  const component = new sandbox.Component();
  component.props = {};
  return { component, document, html };
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

test('homepage preserves its place, craft, and wholesale action contract', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'index.html'), 'utf8');

  assert.match(html, /Kampung Manik &middot; Samarinda &middot; East Kalimantan/);
  assert.match(html, /We believe Borneo beadwork belongs in contemporary life\./);
  assert.match(html, />Wholesale enquiry<\/button>/);
  assert.match(html, />Explore the collection<\/button>/);
  assert.match(html, /href="\/collection\/table-runners"/);
  assert.doesNotMatch(html, /href="\/collection\/table-textiles"/);
});

test('wholesale trust section presents only supported at-a-glance facts', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'wholesale.html'), 'utf8');

  assert.match(html, /Wholesale at a glance/);
  assert.match(html, /Made in Samarinda, East Kalimantan/);
  assert.match(html, /Samples can be discussed/);
  assert.match(html, /Tracked courier for samples and smaller cartons/);
  assert.match(html, /Volume shipping via Balikpapan/);
  assert.match(html, /Handmade variations are expected/);
  assert.match(html, /coordinated with beading groups/i);
  assert.match(html, /href="\/wholesale#wholesale-enquiry"/);
  assert.doesNotMatch(html, /<dt[^>]*>Incoterms<\/dt>|<dt[^>]*>Lead times<\/dt>|<dt[^>]*>Payment<\/dt>/);
});

test('contact consistency keeps email, social, and InaExport URLs on every generated page', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const manifest = await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const contactUrls = [
    'mailto:beads@alwintru.com',
    'https://www.instagram.com/alanawinatrudi',
    'https://www.linkedin.com/company/pt-alana-wina-trudi/',
    'https://inaexport.id/perusahaan/80801-alana-wina-trudi'
  ];

  for (const route of manifest.routes) {
    const html = await readFile(outputFileForPath(outDir, route.path), 'utf8');
    for (const url of contactUrls) assert.match(html, new RegExp(`href="${url}"`), route.path);
  }
});

test('footer links retain practical mobile touch targets without changing footer copy', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'index.html'), 'utf8');

  assert.match(html, /footer a\{display:inline-flex;align-items:center;min-height:44px/);
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

test('enquiry UI exposes the short accessible buyer form', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'wholesale.html'), 'utf8');

  for (const name of ['name', 'company', 'email', 'country', 'message', 'website']) {
    assert.match(html, new RegExp(`name="${name}"`));
  }
  assert.doesNotMatch(html, /name="businessType"|name="orderSize"|name="phone"/);
  assert.match(html, /id="wholesale-enquiry"/);
  assert.match(html, /Wholesale enquiry|Send a wholesale enquiry/);
  assert.match(html, /aria-live="(polite|assertive)"/);
});

test('enquiry UI labels fields, protects the honeypot, and exposes accessible status summaries', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'wholesale.html'), 'utf8');

  for (const field of ['name', 'company', 'email', 'country', 'message', 'website']) {
    assert.match(html, new RegExp(`<label[^>]*for="enquiry-${field}"`));
    assert.match(html, new RegExp(`id="enquiry-${field}"[^>]*aria-describedby="enquiry-${field}-error"`));
  }
  assert.match(html, /name="fax"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
  assert.match(html, /aria-hidden="true"[^>]*><label for="enquiry-fax"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /id="enquiry-success"[^>]*tabindex="-1"[^>]*aria-live="polite"/);
  assert.match(html, /id="enquiry-error"[^>]*tabindex="-1"[^>]*aria-live="assertive"/);
  assert.match(html, /<form[^>]*noValidate="\{\{ true \}\}"/);
  assert.match(html, /<label for="enquiry-name">Name \*<\/label>/);
  assert.match(html, /<label for="enquiry-company">Company \/ shop \*<\/label>/);
  assert.match(html, /<label for="enquiry-website">Website \/ Instagram — optional<\/label>/);
  assert.match(html, /Thank you\. Your enquiry has been sent\./);
  assert.match(html, /We couldn't send your enquiry\./);
  assert.match(html, /\.enquiry-form-grid\{[^}]*display:grid/);
  assert.match(html, /\.enquiry-control\{[^}]*width:100%[^}]*min-height:44px/);
  assert.match(html, /\.enquiry-submit-row\{[^}]*display:flex/);
  assert.match(html, /\.enquiry-remove-button\{[^}]*min-width:44px/);
  assert.match(html, /class="enquiry-remove-button"[^>]*aria-label="Remove \{\{ selection\.name \}\} from enquiry"/);
});

test('direct and popstate product routes focus the dialog close control', async () => {
  const focusOrder = [];
  const close = { focus: () => focusOrder.push('close') };
  const product = { id: 'amira', name: 'Amira Tote' };
  const location = { pathname: '/collection/bags/amira-tote', hash: '', protocol: 'https:' };
  const { component } = await loadRuntimeComponent({
    elements: new Map([['product-dialog-close', close]]),
    windowImpl: { addEventListener() {}, removeEventListener() {} },
    globals: { history: { pushState() {}, replaceState() {} }, location }
  });
  component.catalogue = () => ({});
  component.routeData = () => [];
  component.syncMeta = () => {};
  component.reveal = () => {};
  component.scrollToTop = () => {};
  component.pageFromPath = () => 'collection';
  component.collectionStateFromPath = () => ({ cat: 'Bags', product });

  component.componentDidMount();
  assert.deepEqual(focusOrder, ['close']);

  component.collectionStateFromPath = () => ({ cat: 'Bags', product: null });
  component._pop();
  component.collectionStateFromPath = () => ({ cat: 'Bags', product });
  component._pop();
  assert.deepEqual(focusOrder, ['close', 'close']);
});

test('session shortlist stays unique, can remove products, and routes to the focused enquiry', async () => {
  const enquiryApi = {
    uniqueSelections(items) {
      const seen = new Set();
      return items.filter(item => !seen.has(item.id) && seen.add(item.id));
    }
  };
  const { component } = await loadRuntimeComponent({ enquiryApi });
  const product = { id: 'amira', name: 'Amira Tote' };
  const routes = [];
  component.goTo = (...args) => routes.push(args);
  component.state = { ...component.state, product };

  component.addProductToEnquiry(product, { preventDefault() {} });
  component.state = { ...component.state, product };
  component.addProductToEnquiry(product, { preventDefault() {} });

  assert.equal(component.state.selectedProducts.length, 1);
  assert.equal(component.state.selectedProducts[0].id, 'amira');
  assert.deepEqual(routes.at(-1), ['wholesale', 'wholesale-enquiry', 'enquiry-heading']);
  component.removeProductFromEnquiry('amira');
  assert.equal(component.state.selectedProducts.length, 0);
});

test('enquiry submission validates before sending and resets only after success', async () => {
  const calls = [];
  const focused = [];
  const elements = new Map([
    ['enquiry-success', { focus: () => focused.push('success') }],
    ['enquiry-error', { focus: () => focused.push('error') }]
  ]);
  class TestFormData {
    constructor(form) { this.form = form; }
    entries() { return this.form.entries[Symbol.iterator](); }
  }
  const enquiryApi = {
    uniqueSelections: items => items,
    buildPayload(formData, selectedProducts) {
      return { name: formData.form.values.name, selectedProducts };
    },
    async submitEnquiry(request) {
      calls.push(request);
      return { ok: true };
    }
  };
  const { component } = await loadRuntimeComponent({ enquiryApi, elements, FormDataImpl: TestFormData });
  component.props.formEndpoint = '/test';
  component.state = { ...component.state, selectedProducts: [{ id: 'amira', name: 'Amira Tote' }] };
  const invalidForm = { reportValidity: () => false };
  await component.submit({ preventDefault() {}, target: invalidForm });
  assert.equal(calls.length, 0);
  assert.equal(component.state.formStatus, 'idle');

  let reset = false;
  const form = {
    values: { name: 'Buyer' },
    entries: [['name', 'Buyer']],
    reportValidity: () => true,
    reset: () => { reset = true; }
  };
  await component.submit({ preventDefault() {}, target: form });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, '/test');
  assert.equal(calls[0].payload.name, 'Buyer');
  assert.equal(component.state.formStatus, 'success');
  assert.equal(component.state.sending, false);
  assert.equal(component.state.selectedProducts.length, 0);
  assert.equal(reset, true);
  assert.deepEqual(focused, ['success']);
});

test('failed enquiry keeps form values and selections and permits retry without live requests', async () => {
  const focused = [];
  const elements = new Map([['enquiry-error', { focus: () => focused.push('error') }]]);
  class TestFormData {
    constructor(form) { this.form = form; }
    entries() { return this.form.entries[Symbol.iterator](); }
  }
  let attempts = 0;
  const enquiryApi = {
    uniqueSelections: items => items,
    buildPayload: (formData, selectedProducts) => ({ name: formData.form.values.name, selectedProducts }),
    async submitEnquiry() {
      attempts += 1;
      throw new Error('offline');
    }
  };
  const { component } = await loadRuntimeComponent({ enquiryApi, elements, FormDataImpl: TestFormData });
  component.props.formEndpoint = '/test';
  component.state = { ...component.state, selectedProducts: [{ id: 'amira', name: 'Amira Tote' }] };
  let reset = false;
  const form = {
    values: { name: 'Buyer' },
    entries: [['name', 'Buyer']],
    reportValidity: () => true,
    reset: () => { reset = true; }
  };

  await component.submit({ preventDefault() {}, target: form });

  assert.equal(attempts, 1);
  assert.equal(component.state.formStatus, 'error');
  assert.equal(component.state.formError, 'offline');
  assert.equal(component.state.sending, false);
  assert.equal(component.state.selectedProducts[0].id, 'amira');
  assert.equal(form.values.name, 'Buyer');
  assert.equal(reset, false);
  assert.deepEqual(focused, ['error']);
});

test('sending enquiry ignores duplicate submits', async () => {
  let resolveRequest;
  let attempts = 0;
  class TestFormData { entries() { return [][Symbol.iterator](); } }
  const enquiryApi = {
    uniqueSelections: items => items,
    buildPayload: () => ({}),
    submitEnquiry: async () => {
      attempts += 1;
      await new Promise(resolve => { resolveRequest = resolve; });
      return { ok: true };
    }
  };
  const { component } = await loadRuntimeComponent({ enquiryApi, FormDataImpl: TestFormData });
  component.props.formEndpoint = '/test';
  const form = { reportValidity: () => true, reset() {} };

  const first = component.submit({ preventDefault() {}, target: form });
  const second = component.submit({ preventDefault() {}, target: form });
  assert.equal(attempts, 1);
  resolveRequest();
  await Promise.all([first, second]);
});

test('sending enquiry protects its submitted shortlist and new shortlist work resets success state', async () => {
  let resolveRequest;
  class TestFormData { entries() { return [][Symbol.iterator](); } }
  const enquiryApi = {
    uniqueSelections: items => [...new Map(items.map(item => [item.id, item])).values()],
    buildPayload: (_formData, selectedProducts) => ({ selectedProducts }),
    submitEnquiry: () => new Promise(resolve => { resolveRequest = resolve; })
  };
  const { component } = await loadRuntimeComponent({ enquiryApi, FormDataImpl: TestFormData });
  component.props.formEndpoint = '/test';
  component.goTo = () => {};
  component.state = { ...component.state, selectedProducts: [{ id: 'amira', name: 'Amira Tote' }] };
  const form = { reportValidity: () => true, reset() {} };

  const pending = component.submit({ preventDefault() {}, target: form });
  component.addProductToEnquiry({ id: 'zania', name: 'Zania Handbag' }, { preventDefault() {} });
  component.removeProductFromEnquiry('amira');
  assert.deepEqual(Array.from(component.state.selectedProducts, product => product.id), ['amira']);

  resolveRequest({ ok: true });
  await pending;
  assert.equal(component.state.formStatus, 'success');
  assert.deepEqual(Array.from(component.state.selectedProducts), []);

  component.addProductToEnquiry({ id: 'zania', name: 'Zania Handbag' }, { preventDefault() {} });
  assert.equal(component.state.formStatus, 'idle');
  assert.deepEqual(Array.from(component.state.selectedProducts, product => product.id), ['zania']);
  component.removeProductFromEnquiry('zania');
  assert.equal(component.state.formStatus, 'idle');

  component.state = { ...component.state, formStatus: 'error', formError: 'offline', selectedProducts: [{ id: 'amira', name: 'Amira Tote' }] };
  component.removeProductFromEnquiry('amira');
  assert.equal(component.state.formStatus, 'idle');
  assert.equal(component.state.formError, '');
});

test('product dialog focuses close, traps tab, and returns focus to its opener', async () => {
  const focusOrder = [];
  const opener = { focus: () => focusOrder.push('opener') };
  const close = { focus: () => focusOrder.push('close') };
  const action = { focus: () => focusOrder.push('action') };
  const selectors = [];
  const dialog = {
    querySelectorAll: (selector) => {
      selectors.push(selector);
      return selectors.length === 1 ? [close, action] : [close];
    }
  };
  const elements = new Map([
    ['product-dialog-close', close],
    ['product-dialog', dialog]
  ]);
  const { component, document } = await loadRuntimeComponent({ elements });
  component.pushCollectionRoute = () => {};
  const product = { id: 'amira', name: 'Amira Tote' };

  component.openProduct(product, { preventDefault() {}, currentTarget: opener });
  assert.deepEqual(focusOrder, ['close']);
  document.activeElement = action;
  let prevented = false;
  component.trapProductDialogFocus({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(focusOrder, ['close', 'close']);
  assert.match(selectors[0], /button:not\(:disabled\)/);
  assert.match(selectors[0], /input:not\(:disabled\)/);
  assert.match(selectors[0], /select:not\(:disabled\)/);
  assert.match(selectors[0], /textarea:not\(:disabled\)/);

  document.activeElement = close;
  let oneElementPrevented = false;
  component.trapProductDialogFocus({ key: 'Tab', shiftKey: true, preventDefault: () => { oneElementPrevented = true; } });
  assert.equal(oneElementPrevented, true);
  assert.deepEqual(focusOrder, ['close', 'close', 'close']);
  component.closeModal();
  assert.deepEqual(focusOrder, ['close', 'close', 'close', 'opener']);
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
  assert.match(html, /name, company \/ organisation, email, country, website or Instagram, and message/i);
  assert.match(html, /Formspree/);
  assert.match(html, /beads@alwintru\.com/);
  assert.match(html, /reasonable business records/i);
  assert.match(html, /correction or deletion/i);
  assert.match(html, /no method of transmission or storage is completely secure/i);
  assert.match(html, /YouTube.*only after you choose to play/i);
  assert.match(html, /external social and official links/i);
});

test('runtime provenance avoids unverified motif meanings and only exposes known specifications', async () => {
  const { component } = await loadRuntimeComponent();
  const products = component.products();
  const coaster = products.find(product => product.id === 'coaster-turquoise-fringe');
  const amira = products.find(product => product.id === 'amira');

  assert.equal(component.provenanceLabel(coaster), 'Contemporary decorative');
  assert.equal(coaster.provenanceDescription, '');
  assert.equal(coaster.hasProvenanceDescription, false);
  assert.equal(coaster.motifMeaning, undefined);
  assert.equal(coaster.hasDimensions, false);
  assert.equal(coaster.hasWeight, false);
  assert.equal(coaster.hasHsCode, false);
  assert.equal(coaster.productId, 'coaster-turquoise-fringe');
  assert.equal(coaster.productionLocation, 'Kampung Manik, Samarinda, East Kalimantan, Indonesia');
  assert.equal(amira.hasDimensions, true);
  assert.equal(amira.hasHsCode, true);
  assert.equal(amira.hasVariationNote, true);
  assert.equal(amira.meta, amira.summary);
  assert.ok(component.products().every(product => product.meta));
});

test('runtime suppresses contemporary provenance copy that repeats the product description', async () => {
  const { component } = await loadRuntimeComponent();
  const amira = component.products().find(product => product.id === 'amira');

  assert.equal(amira.provenanceDescription, '');
  assert.equal(amira.hasProvenanceDescription, false);
  assert.equal(amira.provenanceLabel, 'Contemporary Borneo');
});

test('generated product fallback omits missing specifications', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'collection/coasters/manik-turquoise-fringe-coaster.html'), 'utf8');

  assert.match(html, /<dt>Materials<\/dt><dd>Glass seed beads, cotton thread, protective backing<\/dd>/);
  assert.match(html, /<dt>Production location<\/dt><dd>Kampung Manik, Samarinda, East Kalimantan, Indonesia<\/dd>/);
  assert.doesNotMatch(html, /<dt>Dimensions<\/dt>/);
  assert.doesNotMatch(html, /<dt>Weight<\/dt>/);
  assert.doesNotMatch(html, /<dt>HS code<\/dt>/);
});

test('motifs output states the multiple-community and no-unconfirmed-attribution policy', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'awt-site-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await buildSite({ rootDir: process.cwd(), outDir, siteUrl: 'https://beads.alwintru.com' });
  const html = await readFile(join(outDir, 'motifs.html'), 'utf8');

  assert.match(html, /multiple communities and traditions/i);
  assert.match(html, /do not assign cultural meanings without confirmation/i);
});
