# European B2B Website Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `beads.alwintru.com` into a trustworthy, statically indexable European-facing wholesale site with reliable enquiries and conservative cultural provenance.

**Architecture:** Preserve the existing lightweight DC runtime and visual system. Move product records into `catalogue.json`, add focused build and enquiry modules, and have `build.mjs` generate every primary/category/product page plus metadata, structured data, fallback HTML, redirects, and sitemap into `dist/`.

**Tech Stack:** Static HTML/CSS, existing DC/React runtime, browser JavaScript, Node.js ESM build scripts, Node built-in `node:test`, Formspree, Cloudflare static hosting.

**Spec:** `docs/superpowers/specs/2026-08-28-european-b2b-website-upgrade-design.md`

## Global Constraints

- Preserve “We believe Borneo beadwork belongs in contemporary life.” and “Kampung Manik · Samarinda · East Kalimantan.”
- Preserve the cream/oat/sand/brown/dark-cocoa palette, bead-red accents, typography, photography-led identity, and current restrained editorial layout.
- The primary action is “Wholesale enquiry”; the secondary action is “Explore the collection”; product action is “Enquire about this piece”.
- Remove every live customer-facing `line sheet`/`linesheet` concept, including IDs, state names, configuration descriptions, metadata, fallback content, and comments.
- Do not introduce checkout, totals, public prices, inventory, payment, shipping calculation, accounts, CAPTCHA, or a large framework.
- Never fabricate product facts, cultural meaning, MOQ, lead time, capacity, payment terms, Incoterms, certifications, offers, reviews, ratings, availability, GTINs, or prices.
- Unverified cultural claims display neutral visual descriptions; specific attribution requires recorded evidence or maker confirmation.
- Keep Formspree configurable and never send automated or manual test enquiries to the live owner inbox.
- Do not modify or commit unrelated untracked workbook, outreach, output, cache, or temporary artifacts.

---

### Task 1: Establish the catalogue contract and validation tests

**Files:**
- Create: `catalogue.json`
- Create: `test/catalogue.test.mjs`
- Create: `test/helpers.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `catalogue.json` with `{ categories: Category[], products: Product[] }`.
- Produces: `readCatalogue(): Catalogue` in `test/helpers.mjs`.
- `Category`: `{ id: string, name: string, slug: string, image: string, alt: string, description: string }`.
- `Product`: `{ id, name, slug, categoryId, status, image, alt, summary, description, materials?, dimensions?, weight?, colours?, hardware?, care?, productionLocation, hsCode?, variationNote?, gallery, provenance }`.
- `Provenance`: `{ classification: "verified-heritage" | "contemporary-borneo" | "contemporary-decorative", visualDescription: string, motifName?: string, community?: string, meaning?: string, source?: string, makerConfirmed?: boolean }`.

- [ ] **Step 1: Add the failing catalogue contract tests**

```js
// test/helpers.mjs
import { readFile } from 'node:fs/promises';

export async function readCatalogue() {
  return JSON.parse(await readFile(new URL('../catalogue.json', import.meta.url), 'utf8'));
}
```

```js
// test/catalogue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readCatalogue } from './helpers.mjs';

test('catalogue has unique stable IDs and canonical slugs', async () => {
  const { categories, products } = await readCatalogue();
  assert.equal(new Set(categories.map(x => x.id)).size, categories.length);
  assert.equal(new Set(categories.map(x => x.slug)).size, categories.length);
  assert.equal(new Set(products.map(x => x.id)).size, products.length);
  assert.equal(new Set(products.map(x => `${x.categoryId}/${x.slug}`)).size, products.length);
});

test('active products satisfy the public catalogue contract', async () => {
  const { categories, products } = await readCatalogue();
  const categoryIds = new Set(categories.map(x => x.id));
  for (const product of products.filter(x => x.status === 'active')) {
    for (const key of ['id', 'name', 'slug', 'categoryId', 'image', 'alt', 'summary', 'description', 'productionLocation']) {
      assert.equal(typeof product[key], 'string', `${product.id}.${key}`);
      assert.ok(product[key].trim(), `${product.id}.${key}`);
    }
    assert.ok(categoryIds.has(product.categoryId), product.id);
    assert.ok(['verified-heritage', 'contemporary-borneo', 'contemporary-decorative'].includes(product.provenance.classification), product.id);
    assert.ok(product.provenance.visualDescription, product.id);
  }
});

test('specific cultural claims require evidence', async () => {
  const { products } = await readCatalogue();
  for (const product of products) {
    const p = product.provenance;
    if (p.classification === 'verified-heritage') {
      assert.ok(p.motifName, product.id);
      assert.ok(p.community, product.id);
      assert.ok(p.source || p.makerConfirmed === true, product.id);
    } else {
      assert.equal(p.meaning, undefined, product.id);
    }
  }
});
```

- [ ] **Step 2: Run the tests to verify the missing catalogue fails**

Run: `node --test test/catalogue.test.mjs`

Expected: FAIL with `ENOENT` for `catalogue.json`.

- [ ] **Step 3: Create `catalogue.json` from every product currently returned by `products()`**

Use stable existing `id` values, preserve current canonical product slugs, map `archived: true` to `status: "archived"`, and map categories to these stable IDs/slugs:

```json
{
  "categories": [
    { "id": "home-decor", "name": "Home décor", "slug": "home-decor" },
    { "id": "earrings", "name": "Earrings", "slug": "earrings" },
    { "id": "necklaces", "name": "Necklaces", "slug": "necklaces" },
    { "id": "bracelets", "name": "Bracelets", "slug": "bracelets" },
    { "id": "bags", "name": "Bags", "slug": "bags" },
    { "id": "keychains", "name": "Keychains", "slug": "keychains" },
    { "id": "coasters", "name": "Coasters", "slug": "coasters" },
    { "id": "table-runners", "name": "Beaded Table Runners", "slug": "table-runners" }
  ],
  "products": []
}
```

Fill each category’s image, alt, and description from its existing category card. Preserve known factual product values. Omit strings such as “In the line sheet”, “Available in the line sheet”, “Included in the line sheet”, and “Confirmed per order”. Classify currently unattributed floral/geometric pieces as `contemporary-decorative`; use `contemporary-borneo` where the description can factually state connection to the Samarinda craft ecosystem. Do not create `verified-heritage` records without a repository citation or explicit maker-confirmation record.

- [ ] **Step 4: Ignore generated build output**

Append only these generated paths if they are not already ignored:

```gitignore
dist/
.tmp-test-site/
```

- [ ] **Step 5: Run the catalogue tests**

Run: `node --test test/catalogue.test.mjs`

Expected: all three tests PASS.

- [ ] **Step 6: Commit the catalogue contract**

```bash
git add .gitignore catalogue.json test/helpers.mjs test/catalogue.test.mjs
git commit -m "refactor: establish authoritative product catalogue"
```

---

### Task 2: Refactor the build into testable static route generation

**Files:**
- Create: `site-routes.mjs`
- Create: `build-lib.mjs`
- Create: `test/build-routes.test.mjs`
- Modify: `build.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `catalogue.json` from Task 1.
- Produces: `PRIMARY_ROUTES`, `categoryPath(category)`, `productPath(product, catalogue)`, and `allIndexableRoutes(catalogue)` in `site-routes.mjs`.
- Produces: `buildSite({ rootDir, outDir, siteUrl, formEndpoint? }): Promise<BuildManifest>` in `build-lib.mjs`.
- `BuildManifest`: `{ routes: { path: string, output: string, kind: string }[], sitemapUrls: string[] }`.

- [ ] **Step 1: Write failing route-generation tests**

```js
// test/build-routes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../build-lib.mjs';

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
```

- [ ] **Step 2: Run the tests to verify the new build API is absent**

Run: `node --test test/build-routes.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `build-lib.mjs`.

- [ ] **Step 3: Define routes independently of the runtime template**

Create `site-routes.mjs` with primary route records containing `key`, `path`, `title`, `description`, `ogImage`, and `kind`. Include `/privacy`. Implement category and product route records from active catalogue data. Product paths must be `/collection/{category.slug}/{product.slug}`.

```js
export function productPath(product, catalogue) {
  const category = catalogue.categories.find(x => x.id === product.categoryId);
  if (!category) throw new Error(`Unknown category ${product.categoryId} for ${product.id}`);
  return `/collection/${category.slug}/${product.slug}`;
}

export function allIndexableRoutes(catalogue) {
  const active = catalogue.products.filter(x => x.status === 'active');
  return [
    ...PRIMARY_ROUTES,
    ...catalogue.categories.map(categoryRoute),
    ...active.map(product => productRoute(product, catalogue))
  ];
}
```

- [ ] **Step 4: Implement the static build library**

Move reusable build behavior from `build.mjs` into `build-lib.mjs`. Read `index.html` and `catalogue.json`, inject the escaped catalogue JSON into `<script type="application/json" id="awt-catalogue"></script>`, set every static metadata tag including `og:image`, generate appropriate JSON-LD, inject route-specific fallback content, write flat `.html` route files, copy assets, generate redirects, and return the manifest.

Use this output mapping so canonical paths do not acquire trailing slashes:

```js
export function outputFileForPath(outDir, path) {
  return path === '/'
    ? join(outDir, 'index.html')
    : join(outDir, `${path.replace(/^\//, '')}.html`);
}
```

Escape `<`, `>`, `&`, U+2028, and U+2029 in embedded JSON so catalogue text cannot terminate the script element.

- [ ] **Step 5: Reduce `build.mjs` to the CLI entrypoint**

```js
import { buildSite } from './build-lib.mjs';

const manifest = await buildSite({
  rootDir: process.cwd(),
  outDir: 'dist',
  siteUrl: 'https://beads.alwintru.com'
});

for (const route of manifest.routes) console.log(`${route.path} -> ${route.output}`);
console.log(`built ${manifest.routes.length} routes`);
```

- [ ] **Step 6: Replace the inline `ROUTES()` metadata table with imported build data hooks**

Keep runtime navigation mapping in `index.html`, but remove the build script’s regex dependency. Add the empty `awt-catalogue` script marker to source HTML and make runtime catalogue parsing fail loudly with a readable error when someone serves unbuilt source HTML.

- [ ] **Step 7: Run route tests and production build**

Run: `node --test test/build-routes.test.mjs && node build.mjs`

Expected: tests PASS; build reports primary, category, and active product routes under `dist/`.

- [ ] **Step 8: Commit static route generation**

```bash
git add site-routes.mjs build-lib.mjs build.mjs index.html test/build-routes.test.mjs
git commit -m "feat: generate static category and product routes"
```

---

### Task 3: Generate sitemap, redirects, fallback HTML, and structured data

**Files:**
- Modify: `build-lib.mjs`
- Modify: `site-routes.mjs`
- Modify: `test/build-routes.test.mjs`
- Modify: `robots.txt`
- Delete: `sitemap.xml`
- Modify: `_redirects`

**Interfaces:**
- Consumes: `BuildManifest.routes` from Task 2.
- Produces: generated `dist/sitemap.xml` and `dist/_redirects`.

- [ ] **Step 1: Add failing sitemap and structured-data assertions**

Add tests that parse generated sitemap `<loc>` values and assert:

```js
assert.equal(urls.length, new Set(urls).size);
assert.ok(urls.includes('https://beads.alwintru.com/privacy'));
assert.ok(urls.includes('https://beads.alwintru.com/collection/bags/amira-tote'));
assert.ok(!urls.some(url => url.includes('mahulu-woven-rattan-cuff-set')));
assert.match(productHtml, /"@type":"Product"/);
assert.match(productHtml, /"@type":"BreadcrumbList"/);
assert.doesNotMatch(productHtml, /"offers"|"aggregateRating"|"gtin"/);
```

Also assert category HTML contains `CollectionPage` and `BreadcrumbList`, and fallback HTML contains the route’s actual heading and description without a hardcoded product count.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test --test-name-pattern="sitemap|structured|fallback" test/build-routes.test.mjs`

Expected: FAIL because sitemap and route JSON-LD are not yet generated from the manifest.

- [ ] **Step 3: Generate sitemap and route JSON-LD**

Generate absolute canonical `<loc>` entries for every indexable route. Generate only truthful Organization, CollectionPage, Product, and BreadcrumbList objects. Product JSON-LD uses name, description, image, material when present, category, product identifier, production location where expressible, and no Offer.

- [ ] **Step 4: Generate route-aware fallback content**

Primary fallback pages use their page description. Category fallback includes category title/description and links to its active products. Product fallback includes name, description, known public specifications, provenance-safe display text, and a link to `/wholesale#wholesale-enquiry`.

- [ ] **Step 5: Generate redirect rules and remove the hand-maintained sitemap**

Keep the SPA fallback last. Add explicit legacy rules first, including `/collection/table-textiles/*` to `/collection/table-runners/:splat` and the existing `/collection/jewelry/*` compatibility behavior where a known product mapping exists. Do not redirect unknown paths to a misleading product.

Delete the repository-root hand-maintained `sitemap.xml`; `build.mjs` becomes its source. Keep `robots.txt` pointing to `https://beads.alwintru.com/sitemap.xml`.

- [ ] **Step 6: Run tests and inspect generated files**

Run: `node --test test/build-routes.test.mjs && node build.mjs && rg -n "<loc>|@type|line[ -]?sheet" dist/sitemap.xml dist/collection/bags/amira-tote.html dist/privacy.html`

Expected: tests PASS; sitemap contains active routes; structured data is present; no line-sheet match occurs.

- [ ] **Step 7: Commit generated SEO architecture**

```bash
git add build-lib.mjs site-routes.mjs test/build-routes.test.mjs robots.txt _redirects sitemap.xml
git commit -m "feat: generate sitemap and structured route data"
```

---

### Task 4: Build and test the enquiry state machine

**Files:**
- Create: `enquiry.js`
- Create: `test/enquiry.test.mjs`
- Modify: `build-lib.mjs`

**Interfaces:**
- Produces browser global `window.AWTEnquiry` and CommonJS export for Node tests.
- Produces `uniqueSelections(items)`, `buildPayload(formData, selectedProducts)`, and `submitEnquiry({ endpoint, payload, fetchImpl })`.
- `submitEnquiry` resolves parsed response data only for `response.ok`; otherwise throws `EnquirySubmissionError` with `status`.

- [ ] **Step 1: Write failing pure enquiry tests**

```js
// test/enquiry.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { uniqueSelections, buildPayload, submitEnquiry } = require('../enquiry.js');

test('shortlist is unique by stable product ID', () => {
  assert.deepEqual(uniqueSelections([
    { id: 'amira', name: 'Amira Tote' },
    { id: 'amira', name: 'Amira Tote' },
    { id: 'lisha', name: 'Lisha Crossbody' }
  ]), [
    { id: 'amira', name: 'Amira Tote' },
    { id: 'lisha', name: 'Lisha Crossbody' }
  ]);
});

test('payload preserves buyer fields and selected products', () => {
  const form = new FormData();
  form.set('name', 'Buyer');
  form.set('company', 'Design Shop');
  form.append('categories', 'Bags');
  const payload = buildPayload(form, [{ id: 'amira', name: 'Amira Tote' }]);
  assert.equal(payload.name, 'Buyer');
  assert.deepEqual(payload.categories, ['Bags']);
  assert.deepEqual(payload.selectedProducts, [{ id: 'amira', name: 'Amira Tote' }]);
});

test('submission succeeds only for a successful HTTP response', async () => {
  await assert.rejects(
    submitEnquiry({ endpoint: '/test', payload: {}, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) }),
    error => error.name === 'EnquirySubmissionError' && error.status === 500
  );
  await assert.doesNotReject(
    submitEnquiry({ endpoint: '/test', payload: {}, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) })
  );
});

test('network failures remain failures', async () => {
  await assert.rejects(
    submitEnquiry({ endpoint: '/test', payload: {}, fetchImpl: async () => { throw new TypeError('offline'); } }),
    /offline/
  );
});
```

- [ ] **Step 2: Run tests to verify the missing module fails**

Run: `node --test test/enquiry.test.mjs`

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the UMD enquiry helpers**

Use a small wrapper that assigns the API to `module.exports` under Node and `globalThis.AWTEnquiry` in the browser. `buildPayload` must convert repeated form keys into arrays, omit the honeypot from the human-readable data fields only if Formspree still receives its supported anti-spam field, and include selected product objects. `submitEnquiry` must set `Accept: application/json` and `Content-Type: application/json`, check `response.ok`, and never use `.finally()` to report success.

- [ ] **Step 4: Copy `enquiry.js` as a build asset**

Add it to the static asset list in `build-lib.mjs` and load it before the DC component logic in `index.html` during the next task.

- [ ] **Step 5: Run enquiry and build tests**

Run: `node --test test/enquiry.test.mjs test/build-routes.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit enquiry domain logic**

```bash
git add enquiry.js test/enquiry.test.mjs build-lib.mjs
git commit -m "feat: add reliable wholesale enquiry state logic"
```

---

### Task 5: Replace the line-sheet flow with the accessible enquiry and shortlist UI

**Files:**
- Modify: `index.html`
- Modify: `test/enquiry.test.mjs`
- Modify: `test/build-routes.test.mjs`

**Interfaces:**
- Consumes: `window.AWTEnquiry` from Task 4 and embedded `#awt-catalogue` from Task 2.
- Produces component state `{ formStatus, formError, selectedProducts, sending }` and actions `addProductToEnquiry`, `removeProductFromEnquiry`, `submit`.

- [ ] **Step 1: Add failing static UI contract tests**

Read generated `wholesale.html` and assert it contains required names and omits disallowed fields:

```js
for (const name of ['name', 'company', 'email', 'country', 'message', 'website']) {
  assert.match(html, new RegExp(`name="${name}"`));
}
assert.doesNotMatch(html, /name="businessType"|name="orderSize"|name="phone"/);
assert.match(html, /id="wholesale-enquiry"/);
assert.match(html, /Wholesale enquiry|Send a wholesale enquiry/);
assert.match(html, /aria-live="(polite|assertive)"/);
```

- [ ] **Step 2: Run the UI contract test to verify failure**

Run: `node --test --test-name-pattern="enquiry UI" test/build-routes.test.mjs`

Expected: FAIL because the old form and line-sheet anchor remain.

- [ ] **Step 3: Replace all enquiry CTAs and anchor names**

Replace header/mobile/home/footer actions with “Wholesale enquiry”, wholesale submit action with “Send a wholesale enquiry”, product action with “Enquire about this piece”, and every `linesheet-form` anchor/state/function/config reference with `wholesale-enquiry` naming.

- [ ] **Step 4: Implement the short accessible form**

Use explicit `for`/`id` label associations rather than wrapping controls. Required fields are `name`, `company`, `email`, `country`, and `message`; optional `website` uses a text field so an Instagram handle is valid. Retain non-required active-category checkboxes. Add a visually hidden honeypot with `tabindex="-1"` and `autocomplete="off"`. Add form privacy copy linking to `/privacy`.

Add `aria-describedby` for field errors, `aria-invalid` when invalid, a polite sending/success region, and an assertive error region. Use `reportValidity()` for native required/email validation before entering sending state.

- [ ] **Step 5: Wire the session shortlist**

On a product detail action, add `{ id, name }` uniquely, close the product dialog, navigate to `/wholesale#wholesale-enquiry`, and focus the shortlist heading or form heading after navigation. Render removable chips/buttons near the form. Removal buttons must say `Remove {product name} from enquiry` to assistive technology. Do not persist selections to localStorage.

- [ ] **Step 6: Wire the four-state submission flow**

Set `formStatus: 'sending'`, disable the submit button, and call `AWTEnquiry.submitEnquiry`. On success, set `formStatus: 'success'`, clear selections, reset the form, and focus the success summary. On error, retain form DOM values and selections, set `formStatus: 'error'`, show the direct mail link, re-enable submission, and focus the error summary. Guard at the start of `submit()` when already sending.

- [ ] **Step 7: Fix product dialog accessibility touched by the flow**

Give the overlay `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the product title. Save the opener before opening; focus the close control after rendering; trap Tab/Shift+Tab within the dialog; restore focus to the opener after close; retain Escape close and body scroll restoration.

- [ ] **Step 8: Run automated tests and build**

Run: `node --test test/enquiry.test.mjs test/build-routes.test.mjs && node build.mjs`

Expected: all tests PASS; production build succeeds.

- [ ] **Step 9: Search the live source and generated UI for legacy conversion copy**

Run:

```bash
rg -n -i "line[ -]?sheet|linesheet|Request the current|in the line sheet|confirmed in the line sheet" index.html build*.mjs site-routes.mjs enquiry.js catalogue.json README.md dist
```

Expected: no matches. Historical design/plan documents and unrelated binary business files are intentionally outside this live-code check.

- [ ] **Step 10: Commit the new buyer journey**

```bash
git add index.html test/enquiry.test.mjs test/build-routes.test.mjs
git commit -m "feat: replace line sheet requests with wholesale enquiries"
```

---

### Task 6: Add privacy and conservative cultural/product presentation

**Files:**
- Modify: `index.html`
- Modify: `site-routes.mjs`
- Modify: `catalogue.json`
- Create: `docs/product-data-gaps.md`
- Create: `docs/wholesale-data-needed.md`
- Create: `docs/inaexport-brand-sync.md`
- Modify: `test/catalogue.test.mjs`
- Modify: `test/build-routes.test.mjs`

**Interfaces:**
- Consumes: provenance classifications from Task 1.
- Produces: runtime `provenanceLabel(product)` and conditional specification rows.

- [ ] **Step 1: Add failing assertions for privacy and safe provenance**

Assert `/privacy` output identifies the enquiry fields, Formspree, `beads@alwintru.com`, retention, rights/contact, security limitations, and external services. Assert generated product HTML omits missing spec rows and that no non-verified product renders `motifMeaning`. Assert the motifs page includes the multiple-community and no-unconfirmed-attribution policy.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test --test-name-pattern="privacy|provenance|missing specifications" test/catalogue.test.mjs test/build-routes.test.mjs`

Expected: FAIL until privacy and conditional rendering are complete.

- [ ] **Step 3: Implement `/privacy` content and navigation**

Add the privacy screen to the DC template/runtime route mapping. Use factual wording identifying Alana Wina Trudi/PT Alana Wina Trudi without asserting an unverified legal-controller formulation. Explain the exact form fields, response/business-relationship purpose, Formspree processing while configured, reasonable business-record retention, contact-based correction/deletion requests subject to legal recordkeeping, ordinary Internet-security limitations, YouTube-on-click behavior, and external social/official links. Add footer and enquiry-form links.

- [ ] **Step 4: Render specifications only when known**

Replace unconditional Materials/Dimensions/Weight/Colourways/Lead time/HS rows with boolean-controlled rows derived from present catalogue fields. Always show the stable product ID/SKU and production location. Add a concise handmade-variation note when present. Do not display a fallback HS code or repeated “confirmed per order”.

- [ ] **Step 5: Rewrite cultural display rules and Motifs & Meaning copy**

For `verified-heritage`, show motif and community plus only supported meaning. For `contemporary-borneo`, label the work “Contemporary Borneo” and show the neutral visual description. For `contemporary-decorative`, label it “Contemporary decorative” and show the neutral visual description. Replace universal cosmology/colour/guardian claims on `/motifs` with the approved conservative explanation.

- [ ] **Step 6: Create owner data-gap documents from the catalogue audit**

`docs/product-data-gaps.md` must list each active product ID and each absent dimensions, weight, materials, hardware/closure, care, or HS-code field that would materially help a buyer. `docs/wholesale-data-needed.md` must list unverified MOQ, sample lead time, production lead time, capacity, payment terms, private label, packaging, and Incoterm facts without proposed invented values.

`docs/inaexport-brand-sync.md` must include the approved short and long positioning copy and manual checks for website, email, MOQ, products, capacity, export markets, Incoterm, description, images, and social links.

- [ ] **Step 7: Run tests, build, and cultural-copy searches**

Run:

```bash
node --test test/catalogue.test.mjs test/build-routes.test.mjs
node build.mjs
rg -n -i "dragon-dog|guardian|ancestor|messenger bird|old cosmology|upper world|lower world|soul|traditional motif" index.html catalogue.json dist/motifs.html dist/collection
```

Expected: tests PASS; every remaining search match is either verified with evidence in the catalogue or removed/reworded neutrally.

- [ ] **Step 8: Commit privacy and provenance safeguards**

```bash
git add index.html site-routes.mjs catalogue.json docs/product-data-gaps.md docs/wholesale-data-needed.md docs/inaexport-brand-sync.md test/catalogue.test.mjs test/build-routes.test.mjs
git commit -m "feat: add privacy and provenance safeguards"
```

---

### Task 7: Strengthen homepage, wholesale trust, contact consistency, and responsive behavior

**Files:**
- Modify: `index.html`
- Modify: `test/build-routes.test.mjs`

**Interfaces:**
- Consumes: active catalogue counts/categories and wholesale enquiry route.
- Produces: final page copy and responsive styles without new dependencies.

- [ ] **Step 1: Add static content-contract assertions**

Assert generated homepage retains the two non-negotiable statements and contains “Wholesale enquiry” plus “Explore the collection”. Assert wholesale contains “Wholesale at a glance”, “Made in Samarinda, East Kalimantan”, samples/shipping facts only when already supported by current repository copy, and the enquiry action. Assert email/social/InaExport URLs are identical across generated pages.

- [ ] **Step 2: Run the content-contract tests to verify missing trust section**

Run: `node --test --test-name-pattern="homepage|wholesale trust|contact consistency" test/build-routes.test.mjs`

Expected: FAIL on the missing “Wholesale at a glance” contract.

- [ ] **Step 3: Tighten page copy without redesigning the homepage**

Preserve the hero and imagery. Ensure the first viewport states place, craft, makers, contemporary purpose, wholesale-only status, and the two approved actions. Replace “line”, “range”, and evasive repeated order-confirmation copy only where it obscures the offer; do not erase normal wholesale vocabulary such as “product line” when it is not a line-sheet request.

- [ ] **Step 4: Add verified wholesale-at-a-glance facts**

Use only repository-supported statements: wholesale only; made/coordinated in Samarinda, East Kalimantan; samples can be discussed; tracked courier for samples/smaller cartons; volume shipping via Balikpapan where the current site already supports it; handmade variations expected; work coordinated with beading groups. Do not surface provisional MOQ, lead time, Incoterm, payment, or capacity values.

- [ ] **Step 5: Audit responsive styles at target widths**

In browser developer tools, inspect 360, 390, 430, 768, and 1280 px. Adjust only affected CSS so navigation, category chips, product cards/dialog, shortlist, form fields/status, and footer fit without horizontal scrolling. Ensure interactive controls have at least 44 px practical touch height and disabled sending state is visibly distinct.

- [ ] **Step 6: Run tests and build**

Run: `node --test test/build-routes.test.mjs && node build.mjs`

Expected: tests PASS and build succeeds.

- [ ] **Step 7: Commit trust and responsive polish**

```bash
git add index.html test/build-routes.test.mjs
git commit -m "feat: strengthen wholesale trust and responsive flow"
```

---

### Task 8: Bring README and Cloudflare deployment documentation in line with reality

**Files:**
- Modify: `README.md`
- Modify: `.openai/hosting.json` only if inspection proves a required setting is missing and the schema supports it
- Create: `test/documentation.test.mjs`

**Interfaces:**
- Documents: `node build.mjs`, `node --test test/*.test.mjs`, `dist/`, `catalogue.json`, Formspree configuration, and generated route behavior.

- [ ] **Step 1: Add failing documentation assertions**

```js
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
```

- [ ] **Step 2: Run the documentation test to verify failure**

Run: `node --test test/documentation.test.mjs`

Expected: FAIL because README still says “no build step”.

- [ ] **Step 3: Rewrite README around the actual workflow**

Document prerequisites, local build, serving `dist/` through a simple static server, test command, output directory, Cloudflare project binding, generated files, catalogue schema/location, adding/archiving a product, recording verified provenance, enquiry endpoint configuration, privacy route, sitemap generation, and deployment settings. Remove completed/stale launch checklist items.

State that Cloudflare must run `node build.mjs` and publish `dist`; if those dashboard settings cannot be read from repository config, label them as dashboard values the owner must verify rather than claiming they are configured.

- [ ] **Step 4: Run documentation and full automated tests**

Run: `node --test test/*.test.mjs && node build.mjs`

Expected: all tests PASS; build succeeds.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md .openai/hosting.json test/documentation.test.mjs
git commit -m "docs: document website build and catalogue workflow"
```

Do not stage `.openai/hosting.json` if it did not change.

---

### Task 9: Production-like browser verification and final legacy audit

**Files:**
- Create: `docs/website-verification-2026-08-28.md`
- Create: `test/serve-dist.mjs`
- Modify: implementation files only when a verified defect requires a fix

**Interfaces:**
- Produces: evidence record with command results, browser matrix, defects found/fixed, and remaining owner actions.

- [ ] **Step 1: Invoke the required verification skill**

Read and follow `superpowers:verification-before-completion` before making any completion claim.

- [ ] **Step 2: Run the clean automated verification suite**

Run:

```bash
node --test test/*.test.mjs
node build.mjs
git diff --check
```

Expected: zero test failures, successful build, and no whitespace errors.

- [ ] **Step 3: Create and start a clean-route local verification server**

Create `test/serve-dist.mjs` using `node:http`. Resolve `/` to `dist/index.html`, an existing asset path to that file, and every extensionless path such as `/collection/bags/amira-tote` to `dist/collection/bags/amira-tote.html`. Reject decoded paths containing `..`, return 404 for absent files, and set HTML/CSS/JS/JSON/XML/image content types from a fixed extension map.

Run: `node test/serve-dist.mjs`

Keep the returned terminal session open for browser testing. Do not use the live Formspree endpoint; override/stub `fetch` in the browser test context or use a local safe response endpoint so no owner email is generated.

- [ ] **Step 4: Perform the desktop browser journey**

At 1280 px, verify homepage, collection, filters, Amira product route, product dialog keyboard containment, “Enquire about this piece”, visible shortlist, required-field validation, simulated 200 success, simulated network failure, simulated non-2xx failure, preserved values after failure, duplicate-submit prevention, privacy, direct category/product loads, refresh, back, forward, and zero significant console errors.

- [ ] **Step 5: Perform responsive and accessibility smoke checks**

Repeat the buyer-critical journey at 360, 390, 430, and 768 px. Check no horizontal scroll, menu operation, 44 px touch targets, visible focus, Escape/close/focus return, label associations, error/status announcements, shortlist removal labels, contrast of new text/buttons, and disabled sending state.

- [ ] **Step 6: Run final live-code legacy and claim audits**

Run:

```bash
rg -n -i "line[ -]?sheet|linesheet|Request the current|pricing in the line sheet|in the line sheet|confirmed in the line sheet" index.html build.mjs build-lib.mjs site-routes.mjs enquiry.js catalogue.json README.md robots.txt _redirects dist
rg -n -i "dragon-dog|guardian|ancestor|messenger bird|old cosmology|upper world|lower world" index.html catalogue.json dist
```

Expected: no line-sheet matches; cultural-claim matches are absent or tied to explicit verified evidence and explained in the verification report.

- [ ] **Step 7: Write the verification evidence**

Record exact test counts, build route count, browser widths, success/failure simulations, console result, legacy-search result, accessibility observations, Cloudflare dashboard items needing manual confirmation, owner product/wholesale data needs, Google Search Console sitemap/resubmission action, and InaExport sync action.

- [ ] **Step 8: Perform final code/self-review**

Review the complete diff against the design spec and acceptance criteria. Check catalogue/build/runtime field-name consistency, archived exclusion, route/canonical agreement, endpoint safety, error preservation, focus restoration, and unrelated-file exclusion. Fix verified defects with focused tests and rerun Steps 2 and 6.

- [ ] **Step 9: Commit verification evidence and any reviewed fixes**

```bash
git add docs/website-verification-2026-08-28.md test/serve-dist.mjs
git commit -m "test: verify European B2B website upgrade"
```

If reviewed fixes changed source files, stage only those files with their tests in a separate preceding commit named for the defect.

---

### Task 10: Prepare the final owner handoff

**Files:**
- Read: `docs/website-verification-2026-08-28.md`
- Read: `docs/product-data-gaps.md`
- Read: `docs/wholesale-data-needed.md`
- Read: `docs/inaexport-brand-sync.md`

**Interfaces:**
- Produces: final user report; no additional code changes.

- [ ] **Step 1: Confirm repository state and commit history**

Run: `git status --short && git log --oneline --decorate -12`

Expected: website work is committed; unrelated pre-existing untracked artifacts remain unstaged and are called out without modification.

- [ ] **Step 2: Report the verified outcome**

Provide the requested twelve-part concise report: what changed, files changed, buyer journey before/after, SEO, cultural safeguards, form reliability, privacy, exact tests/results, owner information required, Cloudflare/Search Console/InaExport manual steps, commits, and remaining risks/limitations. Every success claim must cite evidence from the verification report.
