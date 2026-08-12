# SP-1 "Lead Desk" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every wholesale inquiry lands in an owned D1 database with automatic follow-up dates, triaged through an Access-gated `/admin` dashboard with a daily briefing — at $0/month, with the public site untouched.

**Architecture:** The existing Cloudflare Pages project gains a D1 database, Pages Functions (`/api/lead` public with dual-write to Formspree; `/api/admin/*` JSON API behind Cloudflare Access), and a framework-free `admin/` dashboard. Claude Code operates the same database via wrangler under a repo-committed `business-os` skill.

**Tech Stack:** Cloudflare Pages + Pages Functions + D1 + Access (all free tier) · plain HTML/JS (no framework, matching the house style) · Node 26 built-in `node --test` · wrangler v4 as the only dev dependency.

## Global Constraints

- **Zero runtime npm dependencies.** `wrangler` is the sole devDependency, used locally only. Tests use `node --test` builtins.
- **The repo is public: no prices, buyer data, or secrets in git — ever.** Commercial/buyer data lives only in D1; tokens only in local env / Cloudflare dashboard.
- **The public site must not regress.** `index.html` changes are limited to the form submit path + honeypot field + two props (Task 5). Everything else byte-identical.
- **Prices are integer cents** (`wholesale_price_cents`, `rrp_cents`), currency default `'EUR'`.
- **Lead statuses (exact list, used everywhere):** `new, contacted, replied, line_sheet_sent, sample, quote, order, repeat, lost`.
- **Activity types (exact list):** `form_submission, email_out, email_in, whatsapp, note, status_change, briefing_note`.
- **Business days are Mon–Fri in WITA (UTC+8, no DST).** Follow-up default: +2 business days.
- **Form field names (must match `index.html` exactly):** `company, name, email, country, businessType, website, categories, orderSize, message` + honeypot `fax`.
- **Never invent data.** Missing values stay NULL; UI shows them as gaps to fill.
- **Cloudflare Pages CI build command** (set in Task 12): `node --test tests/unit/ && node build.mjs`. Integration tests (`tests/integration/`) run locally only — they spawn `wrangler pages dev`.
- D1 database name: `awt-business-os`. Binding name: `DB`. Migrations dir: `schema/`.
- Commit after every green test cycle. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## Milestone 1 — Foundation

### Task 1: Toolchain + D1 schema

**Files:**
- Create: `package.json`, `wrangler.toml`, `schema/0001_init.sql`
- Modify: `.gitignore`
- Test: `tests/integration/schema.test.mjs`, `tests/integration/helpers.mjs`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: D1 schema (6 tables above); `helpers.mjs` exports `applyMigrations(persistDir)`, `freshDb() → persistDir` (temp dir with migrations applied), `d1Query(persistDir, sql) → rows[]`, `startMockFormspree() → {received[], url, close()}`, `startPagesDev({formspreeUrl, port, persist?}) → {base, persist, stop()}` used by Tasks 2, 4, 7.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "awt-beads",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "dev": "node build.mjs && wrangler pages dev dist",
    "test": "node --test tests/unit/",
    "test:integration": "node --test --test-concurrency=1 --test-timeout=240000 tests/integration/"
  },
  "devDependencies": {
    "wrangler": "^4.27.0"
  }
}
```

Run: `npm install` (creates `package-lock.json` — commit it).

- [ ] **Step 2: Create `wrangler.toml`**

```toml
name = "awt-beads"
pages_build_output_dir = "dist"
compatibility_date = "2026-08-01"

[[d1_databases]]
binding = "DB"
database_name = "awt-business-os"
database_id = "PASTE-FROM-WRANGLER-D1-CREATE"   # real id set in Task 12; local dev ignores it
migrations_dir = "schema"
```

(The placeholder id is deliberate: the real id comes from the founder's Cloudflare account in Task 12. `wrangler pages dev` and `--local` migrations work without it.)

- [ ] **Step 3: Append to `.gitignore`**

Read the existing `.gitignore` first, keep its contents, append:

```
node_modules/
.wrangler/
```

- [ ] **Step 4: Write `schema/0001_init.sql`**

```sql
-- SP-1 Lead Desk: initial schema. Six tables per the 2026-08-12 design spec.
-- Prices are integer cents. Timestamps are UTC from datetime('now').

CREATE TABLE product (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Home décor','Jewelry','Bags','Keychains','Table textiles')),
  motif TEXT,
  materials TEXT,
  dims TEXT,
  weight TEXT,
  colours TEXT,
  lead_time TEXT,
  hs_code TEXT,
  moq INTEGER,
  wholesale_price_cents INTEGER,
  rrp_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','retired')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE company (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  type TEXT,
  website TEXT,
  instagram TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_company_name ON company (lower(name));

CREATE TABLE contact (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES company(id),
  name TEXT,
  email TEXT NOT NULL,
  phone_whatsapp TEXT,
  role TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_contact_email ON contact (lower(email));

CREATE TABLE lead (
  id INTEGER PRIMARY KEY,
  company_id INTEGER REFERENCES company(id),
  contact_id INTEGER REFERENCES contact(id),
  source TEXT NOT NULL DEFAULT 'website_form',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN
    ('new','contacted','replied','line_sheet_sent','sample','quote','order','repeat','lost')),
  product_interest TEXT,
  order_size TEXT,
  next_follow_up TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lead_follow_up ON lead (next_follow_up);
CREATE INDEX idx_lead_status ON lead (status);

CREATE TABLE activity (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER REFERENCES lead(id),
  company_id INTEGER REFERENCES company(id),
  type TEXT NOT NULL CHECK (type IN
    ('form_submission','email_out','email_in','whatsapp','note','status_change','briefing_note')),
  body TEXT,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (lead_id IS NOT NULL OR company_id IS NOT NULL)
);
CREATE INDEX idx_activity_lead ON activity (lead_id, created_at);
CREATE INDEX idx_activity_type_time ON activity (type, created_at);

CREATE TABLE briefing (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 5: Write `tests/integration/helpers.mjs`**

```js
// Shared harness for local integration tests. Each test file gets its own
// temp D1 state dir, so files never share database state.
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function applyMigrations(persist) {
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'awt-business-os',
    '--local', '--persist-to', persist], { stdio: 'inherit' });
}

export function freshDb() {
  const persist = mkdtempSync(join(tmpdir(), 'awt-d1-'));
  applyMigrations(persist);
  return persist;
}

export function d1Query(persist, sql) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'awt-business-os', '--local',
    '--persist-to', persist, '--json', '--command', sql], { encoding: 'utf8' });
  return JSON.parse(out)[0].results;
}

export function startMockFormspree() {
  const received = [];
  const server = createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      received.push(JSON.parse(b || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    received,
    url: `http://127.0.0.1:${server.address().port}/f/test`,
    close: () => server.close(),
  })));
}

export async function startPagesDev({ formspreeUrl = 'http://127.0.0.1:9/unused', port = 8788, persist = freshDb() } = {}) {
  execFileSync('node', ['build.mjs'], { stdio: 'inherit' });
  const proc = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', String(port),
    '--persist-to', persist, '--binding', `FORMSPREE_URL=${formspreeUrl}`], { stdio: 'pipe' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 240; i++) {
    try { await fetch(base + '/'); return { base, persist, stop: () => proc.kill('SIGTERM') }; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  proc.kill('SIGTERM');
  throw new Error('wrangler pages dev did not start within 120s');
}
```

- [ ] **Step 6: Write the failing schema test `tests/integration/schema.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, d1Query } from './helpers.mjs';

test('migrations create the six SP-1 tables with expected columns', () => {
  const persist = freshDb();
  const tables = d1Query(persist,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf%' AND name != 'd1_migrations' ORDER BY name")
    .map((r) => r.name);
  assert.deepEqual(tables, ['activity', 'briefing', 'company', 'contact', 'lead', 'product']);

  const productCols = d1Query(persist, "SELECT name FROM pragma_table_info('product')").map((r) => r.name);
  for (const col of ['id', 'sku', 'category', 'moq', 'wholesale_price_cents', 'rrp_cents', 'currency', 'status'])
    assert.ok(productCols.includes(col), `product.${col} missing`);

  // The status CHECK constraint must reject junk.
  assert.throws(() => d1Query(persist, "INSERT INTO lead (status) VALUES ('bogus')"));
});
```

- [ ] **Step 7: Run the test — verify it fails before the migration exists, then passes**

Run: `npx wrangler --version` (accept the one-time telemetry prompt if shown), then `npm run test:integration -- --test-name-pattern "six SP-1"`.
First run against an empty `schema/` fails ("no migrations"); with `0001_init.sql` in place: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json wrangler.toml .gitignore schema/0001_init.sql tests/integration/
git commit -m "Add wrangler toolchain and the six-table Lead Desk schema"
```

---

### Task 2: Product extraction, seed migration, drift check

**Files:**
- Create: `scripts/extract-products.mjs`, `scripts/gen-seed.mjs`, `scripts/drift-check.mjs`, `schema/0002_seed_products.sql` (generated)
- Test: `tests/unit/extract-products.test.mjs`, `tests/integration/seed.test.mjs`

**Interfaces:**
- Consumes: `index.html` products() array (read-only); Task 1 helpers.
- Produces: `extractProducts(html) → [{id, name, cat, motif, materials, dims, weight, colours, lead, hs, …}]`; `skuFor(product) → string`; `generateSeedSql(html) → string`; `compareProducts(siteRows, dbRows) → string[]` (drift messages). Seed migration gives D1 its 30 products.

- [ ] **Step 1: Write the failing unit test `tests/unit/extract-products.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractProducts, skuFor } from '../../scripts/extract-products.mjs';
import { generateSeedSql } from '../../scripts/gen-seed.mjs';
import { compareProducts } from '../../scripts/drift-check.mjs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('extracts all 30 products with the fields the seed needs', () => {
  const products = extractProducts(html);
  assert.equal(products.length, 30);
  const amira = products.find((p) => p.id === 'amira');
  assert.equal(amira.name, 'Amira Tote');
  assert.equal(amira.cat, 'Bags');
  assert.equal(amira.hs, '4202 29 00');
});

test('sku scheme matches the line-sheet workbook for earrings and extends it elsewhere', () => {
  const products = extractProducts(html);
  assert.equal(skuFor(products.find((p) => p.id === 'earrings-segitiga-hijau')), 'AWT-EAR-SEGITIGA-HIJAU');
  assert.equal(skuFor(products.find((p) => p.id === 'earrings-hoop-biru')), 'AWT-EAR-HOOP-BIRU');
  assert.equal(skuFor(products.find((p) => p.id === 'amira')), 'AWT-BAG-AMIRA');
  assert.equal(skuFor(products.find((p) => p.id === 'placemats')), 'AWT-TAB-PLACEMATS');
  assert.equal(skuFor(products.find((p) => p.id === 'hanging')), 'AWT-DEC-HANGING');
  assert.equal(skuFor(products.find((p) => p.id === 'keychains')), 'AWT-KEY-KEYCHAINS');
  assert.equal(skuFor(products.find((p) => p.id === 'necklace')), 'AWT-JWL-NECKLACE');
});

test('seed SQL: 30 inserts, placeholder strings become NULL, no price columns', () => {
  const sql = generateSeedSql(html);
  assert.equal(sql.match(/^INSERT INTO product/gm).length, 30);
  assert.ok(!sql.includes('In the line sheet'), 'placeholder weight must seed as NULL');
  assert.ok(!sql.includes('Confirmed per order'), 'placeholder lead time must seed as NULL');
  assert.ok(!sql.includes('To be added'), 'placeholder HS must seed as NULL');
  assert.ok(!sql.includes('wholesale_price_cents'), 'prices are founder work, never seeded');
  assert.ok(sql.includes("'AWT-EAR-RUMBAI-MERAH'"));
});

test('drift compare reports mismatched shared fields and nothing else', () => {
  const site = [{ id: 'amira', name: 'Amira Tote', cat: 'Bags', motif: "Aso'", materials: 'm', dims: 'd', colours: 'c' }];
  const db = [{ id: 'amira', name: 'Amira Tote RENAMED', category: 'Bags', motif: "Aso'", materials: 'm', dims: 'd', colours: 'c' }];
  const msgs = compareProducts(site, db);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /amira.*name/);
  assert.deepEqual(compareProducts(site, [{ ...db[0], name: 'Amira Tote' }]), []);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Write `scripts/extract-products.mjs`**

```js
// Extract the products() array from index.html without executing the app.
// Only the array literal (the part before .map) is evaluated, in an empty
// vm context — in the spirit of build.mjs, nothing else in the file can run.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export function extractProducts(html) {
  const m = html.match(/products\(\)\s*\{[\s\S]*?return (\[[\s\S]*?\])\.map\(/);
  if (!m) throw new Error('extract: could not find the products() array in index.html');
  return vm.runInNewContext('(' + m[1] + ')', Object.create(null), { timeout: 1000 });
}

const CAT_PREFIX = { 'Bags': 'BAG', 'Jewelry': 'JWL', 'Home décor': 'DEC', 'Table textiles': 'TAB', 'Keychains': 'KEY' };

export function skuFor(p) {
  if (p.id.startsWith('earrings-')) return 'AWT-EAR-' + p.id.slice('earrings-'.length).toUpperCase();
  const prefix = CAT_PREFIX[p.cat];
  if (!prefix) throw new Error(`skuFor: unknown category ${p.cat}`);
  return `AWT-${prefix}-${p.id.toUpperCase()}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  console.log(JSON.stringify(extractProducts(html).map((p) => ({ ...p, sku: skuFor(p) })), null, 2));
}
```

- [ ] **Step 4: Write `scripts/gen-seed.mjs`**

```js
// Generate schema/0002_seed_products.sql from the site's product array.
// One-time seed: regenerate freely BEFORE the migration is applied remotely;
// after that the file is frozen history (edit D1 via the admin screen instead).
// Prices/MOQ are never seeded — the line-sheet workbook is an unfilled template
// and pricing is founder work done in the admin Products screen.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractProducts, skuFor } from './extract-products.mjs';

const q = (v) => (v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const PLACEHOLDERS = ['In the line sheet', 'Confirmed per order', 'To be added'];
const real = (v) => (PLACEHOLDERS.includes(v) ? null : v);

export function generateSeedSql(html) {
  const products = extractProducts(html);
  if (products.length !== 30) throw new Error(`expected 30 products, found ${products.length}`);
  const rows = products.map((p) =>
    `INSERT INTO product (id, sku, name, category, motif, materials, dims, weight, colours, lead_time, hs_code)\n` +
    `VALUES (${q(p.id)}, ${q(skuFor(p))}, ${q(p.name)}, ${q(p.cat)}, ${q(p.motif)}, ${q(p.materials)}, ` +
    `${q(p.dims)}, ${q(real(p.weight))}, ${q(p.colours)}, ${q(real(p.lead))}, ${q(real(p.hs))});`);
  return `-- GENERATED by scripts/gen-seed.mjs — do not edit by hand.\n\n${rows.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sql = generateSeedSql(html);
  writeFileSync(new URL('../schema/0002_seed_products.sql', import.meta.url), sql);
  console.log(`wrote ${sql.match(/^INSERT INTO product/gm).length} product rows to schema/0002_seed_products.sql`);
}
```

- [ ] **Step 5: Write `scripts/drift-check.mjs`**

```js
// Warn when index.html presentation fields diverge from D1 (the spec's
// drift check). Pure compare is exported for tests; the CLI queries the
// remote database via wrangler (requires wrangler login).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { extractProducts } from './extract-products.mjs';

// Shared presentation fields: site key -> db column.
const FIELDS = { name: 'name', cat: 'category', motif: 'motif', materials: 'materials', dims: 'dims', colours: 'colours' };

export function compareProducts(siteRows, dbRows) {
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  const msgs = [];
  for (const p of siteRows) {
    const db = byId.get(p.id);
    if (!db) { msgs.push(`${p.id}: on the site but not in D1`); continue; }
    for (const [sk, dk] of Object.entries(FIELDS)) {
      const a = p[sk] ?? null, b = db[dk] ?? null;
      if (a !== b) msgs.push(`${p.id}: ${dk} differs (site: ${JSON.stringify(a)}, D1: ${JSON.stringify(b)})`);
    }
  }
  for (const r of dbRows) if (!siteRows.some((p) => p.id === r.id)) msgs.push(`${r.id}: in D1 but not on the site`);
  return msgs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'awt-business-os', '--remote', '--json',
    '--command', 'SELECT id, name, category, motif, materials, dims, colours FROM product'], { encoding: 'utf8' });
  const msgs = compareProducts(extractProducts(html), JSON.parse(out)[0].results);
  if (msgs.length) { console.error('DRIFT:\n' + msgs.map((m) => '  - ' + m).join('\n')); process.exit(1); }
  console.log('drift-check ok: site and D1 agree on shared presentation fields');
}
```

- [ ] **Step 6: Generate the seed and run unit tests**

Run: `node scripts/gen-seed.mjs` then `npm test`
Expected: seed file written with 30 rows; all unit tests PASS.

- [ ] **Step 7: Write the failing integration test `tests/integration/seed.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, d1Query } from './helpers.mjs';

test('seed migration loads 30 products, earrings carry workbook SKUs, prices all NULL', () => {
  const persist = freshDb();
  assert.equal(d1Query(persist, 'SELECT COUNT(*) AS n FROM product')[0].n, 30);
  const hoop = d1Query(persist, "SELECT sku, category, hs_code FROM product WHERE id = 'earrings-hoop-biru'")[0];
  assert.equal(hoop.sku, 'AWT-EAR-HOOP-BIRU');
  assert.equal(hoop.category, 'Jewelry');
  assert.equal(hoop.hs_code, null);
  const amira = d1Query(persist, "SELECT sku, hs_code FROM product WHERE id = 'amira'")[0];
  assert.equal(amira.sku, 'AWT-BAG-AMIRA');
  assert.equal(amira.hs_code, '4202 29 00');
  assert.equal(d1Query(persist, 'SELECT COUNT(*) AS n FROM product WHERE wholesale_price_cents IS NOT NULL')[0].n, 0);
  assert.equal(d1Query(persist, 'SELECT COUNT(*) AS n FROM product WHERE sku IS NULL')[0].n, 0);
});
```

- [ ] **Step 8: Run integration test to verify it passes**

Run: `npm run test:integration -- --test-name-pattern "seed migration"`
Expected: PASS (migrations now include 0002).

- [ ] **Step 9: Commit**

```bash
git add scripts/ schema/0002_seed_products.sql tests/
git commit -m "Seed the product table from the site array with workbook SKU codes"
```

---

## Milestone 2 — Capture

### Task 3: Pure libs — validation and WITA date math (TDD)

**Files:**
- Create: `lib/validate.mjs`, `lib/dates.mjs`
- Test: `tests/unit/validate.test.mjs`, `tests/unit/dates.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateLead(payload) → {ok:true, data} | {ok:false, errors}` where `data = {company, name, email, country, businessType, website, categories: string[], orderSize, message}`; `isHoneypot(payload) → boolean`; `LEAD_STATUSES` (array); `witaDate(nowMs) → 'YYYY-MM-DD'`; `nextFollowUp(nowMs) → 'YYYY-MM-DD'`. Used by Tasks 4, 7.

- [ ] **Step 1: Write failing tests `tests/unit/dates.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { witaDate, nextFollowUp } from '../../lib/dates.mjs';

// 2026-08-12 is a Wednesday. 04:00 UTC = 12:00 WITA the same day.
const WED = Date.UTC(2026, 7, 12, 4, 0);
const DAY = 86400000;

test('witaDate converts UTC to the WITA calendar date', () => {
  assert.equal(witaDate(WED), '2026-08-12');
  assert.equal(witaDate(Date.UTC(2026, 7, 12, 15, 30)), '2026-08-12'); // 23:30 WITA, still Wed
  assert.equal(witaDate(Date.UTC(2026, 7, 12, 16, 30)), '2026-08-13'); // 00:30 WITA Thursday
});

test('nextFollowUp adds two Mon–Fri business days in WITA', () => {
  assert.equal(nextFollowUp(WED), '2026-08-14');           // Wed -> Fri
  assert.equal(nextFollowUp(WED + DAY), '2026-08-17');     // Thu -> Mon
  assert.equal(nextFollowUp(WED + 2 * DAY), '2026-08-18'); // Fri -> Tue
  assert.equal(nextFollowUp(WED + 3 * DAY), '2026-08-19'); // Sat counts from Mon -> Wed
  assert.equal(nextFollowUp(WED + 4 * DAY), '2026-08-19'); // Sun counts from Mon -> Wed
});
```

- [ ] **Step 2: Write failing tests `tests/unit/validate.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, isHoneypot, LEAD_STATUSES } from '../../lib/validate.mjs';

const GOOD = {
  company: ' Test Store GmbH ', name: 'Anna Buyer', email: 'Anna@Test-Store.example',
  country: 'Germany', businessType: 'Retailer', website: 'https://test-store.example',
  categories: ['Bags', 'Jewelry', 'Not a category'], orderSize: 'Samples first', message: 'Hello',
};

test('accepts a good payload, trims, lowercases email, filters unknown categories', () => {
  const v = validateLead(GOOD);
  assert.equal(v.ok, true);
  assert.equal(v.data.company, 'Test Store GmbH');
  assert.equal(v.data.email, 'anna@test-store.example');
  assert.deepEqual(v.data.categories, ['Bags', 'Jewelry']);
});

test('categories may arrive as a single string (FormData behaviour)', () => {
  assert.deepEqual(validateLead({ ...GOOD, categories: 'Bags' }).data.categories, ['Bags']);
  assert.deepEqual(validateLead({ ...GOOD, categories: undefined }).data.categories, []);
});

test('rejects missing required fields and bad email, reporting each field', () => {
  const v = validateLead({ email: 'not-an-email', message: 'x' });
  assert.equal(v.ok, false);
  for (const f of ['company', 'name', 'email', 'country', 'businessType']) assert.ok(v.errors[f], f);
});

test('rejects oversized fields and non-object payloads', () => {
  assert.equal(validateLead({ ...GOOD, message: 'x'.repeat(5001) }).ok, false);
  assert.equal(validateLead(null).ok, false);
  assert.equal(validateLead('junk').ok, false);
});

test('honeypot: any value in fax flags a bot', () => {
  assert.equal(isHoneypot({ ...GOOD, fax: 'x' }), true);
  assert.equal(isHoneypot(GOOD), false);
  assert.equal(isHoneypot(null), false);
});

test('status list matches the schema CHECK constraint', () => {
  assert.deepEqual(LEAD_STATUSES,
    ['new', 'contacted', 'replied', 'line_sheet_sent', 'sample', 'quote', 'order', 'repeat', 'lost']);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test`
Expected: FAIL — `lib/` modules missing.

- [ ] **Step 4: Write `lib/dates.mjs`**

```js
// WITA (UTC+8, no DST) helpers. Inputs are epoch ms UTC.
const DAY = 86400000, WITA = 8 * 3600000;
const dow = (ms) => new Date(ms).getUTCDay();

export function witaDate(nowMs) {
  return new Date(nowMs + WITA).toISOString().slice(0, 10);
}

// The site promises a reply within two business days (Mon–Fri, WITA).
// Weekend submissions count from the following Monday.
export function nextFollowUp(nowMs) {
  let t = nowMs + WITA;
  while (dow(t) === 0 || dow(t) === 6) t += DAY;
  for (let added = 0; added < 2; ) {
    t += DAY;
    const d = dow(t);
    if (d !== 0 && d !== 6) added++;
  }
  return new Date(t).toISOString().slice(0, 10);
}
```

- [ ] **Step 5: Write `lib/validate.mjs`**

```js
// Server-side validation for the line-sheet request form.
// Field names match the form in index.html exactly.
const CATEGORIES = ['Home décor', 'Jewelry', 'Bags', 'Keychains', 'Table textiles'];
export const LEAD_STATUSES =
  ['new', 'contacted', 'replied', 'line_sheet_sent', 'sample', 'quote', 'order', 'repeat', 'lost'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function isHoneypot(payload) {
  return str(payload?.fax) !== '';
}

export function validateLead(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const data = {
    company: str(p.company), name: str(p.name), email: str(p.email).toLowerCase(),
    country: str(p.country), businessType: str(p.businessType), website: str(p.website),
    orderSize: str(p.orderSize), message: str(p.message),
    categories: (Array.isArray(p.categories) ? p.categories : p.categories != null ? [p.categories] : [])
      .map(str).filter((c) => CATEGORIES.includes(c)),
  };
  const errors = {};
  if (!data.company || data.company.length > 200) errors.company = 'required, max 200 chars';
  if (!data.name || data.name.length > 200) errors.name = 'required, max 200 chars';
  if (data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.email = 'valid email required';
  if (!data.country || data.country.length > 100) errors.country = 'required';
  if (!data.businessType || data.businessType.length > 100) errors.businessType = 'required';
  if (data.website.length > 300) errors.website = 'max 300 chars';
  if (data.orderSize.length > 50) errors.orderSize = 'max 50 chars';
  if (data.message.length > 5000) errors.message = 'max 5000 chars';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test`
Expected: all unit tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/ tests/unit/
git commit -m "Add form validation and WITA business-day helpers"
```

---

### Task 4: Lead capture endpoint with integration coverage

**Files:**
- Create: `lib/store.mjs`, `functions/api/lead.js`
- Test: `tests/integration/lead.test.mjs`, `tests/integration/lead-failures.test.mjs`

**Interfaces:**
- Consumes: Task 3 (`validateLead`, `isHoneypot`, `nextFollowUp`); Task 1 helpers; D1 binding `DB`; env var `FORMSPREE_URL`.
- Produces: `POST /api/lead` → 200 `{ok:true, forward}` | 400 `{ok:false, errors}` | 429 | 500 `{ok:false, errors:{_:'storage failed'}}`. `lib/store.mjs` exports `LEAD_ROW_SQL` (string), `findOrCreateCompany(db, data) → id`, `findOrCreateContact(db, companyId, data) → id`, `createLead(db, {companyId, contactId, data, followUp, meta}) → leadId`, `submissionsFromIp(db, ip, minutes) → number` — reused by Task 7.

- [ ] **Step 1: Write `lib/store.mjs`**

```js
// D1 helpers shared by the public lead endpoint and the admin API.
// Every query is parameterized; SQL is never built from user strings
// (column fragments below come only from server-side whitelists).

export const LEAD_ROW_SQL = `SELECT l.id, l.status, l.source, l.product_interest, l.order_size,
  l.next_follow_up, l.created_at, l.updated_at,
  c.name AS company_name, c.country, ct.name AS contact_name, ct.email AS contact_email
  FROM lead l
  LEFT JOIN company c ON c.id = l.company_id
  LEFT JOIN contact ct ON ct.id = l.contact_id`;

export async function findOrCreateCompany(db, { company, country, businessType, website }) {
  const found = await db.prepare('SELECT id FROM company WHERE lower(name) = lower(?)').bind(company).first();
  if (found) return found.id;
  const r = await db.prepare('INSERT INTO company (name, country, type, website) VALUES (?, ?, ?, ?)')
    .bind(company, country || null, businessType || null, website || null).run();
  return r.meta.last_row_id;
}

export async function findOrCreateContact(db, companyId, { name, email }) {
  const found = await db.prepare('SELECT id FROM contact WHERE lower(email) = lower(?)').bind(email).first();
  if (found) return found.id;
  const r = await db.prepare('INSERT INTO contact (company_id, name, email) VALUES (?, ?, ?)')
    .bind(companyId, name || null, email).run();
  return r.meta.last_row_id;
}

export async function createLead(db, { companyId, contactId, data, followUp, meta }) {
  const r = await db.prepare(
    `INSERT INTO lead (company_id, contact_id, source, product_interest, order_size, next_follow_up)
     VALUES (?, ?, 'website_form', ?, ?, ?)`)
    .bind(companyId, contactId, data.categories.join(', ') || null, data.orderSize || null, followUp).run();
  const leadId = r.meta.last_row_id;
  await db.prepare('INSERT INTO activity (lead_id, company_id, type, body, meta) VALUES (?, ?, ?, ?, ?)')
    .bind(leadId, companyId, 'form_submission', data.message || null, JSON.stringify(meta)).run();
  return leadId;
}

export async function submissionsFromIp(db, ip, minutes) {
  const r = await db.prepare(
    `SELECT COUNT(*) AS n FROM activity
     WHERE type = 'form_submission' AND json_extract(meta, '$.ip') = ?
       AND created_at > datetime('now', ?)`)
    .bind(ip, `-${minutes} minutes`).first();
  return r.n;
}
```

- [ ] **Step 2: Write `functions/api/lead.js`**

```js
// POST /api/lead — the only public API endpoint.
// Order matters: honeypot -> validate -> rate limit -> forward to Formspree
// (dual-write: the email notification keeps arriving) -> store in D1.
// If storage fails we return 500 so the browser falls back to posting
// Formspree directly: a lead is never lost silently.
import { validateLead, isHoneypot } from '../../lib/validate.mjs';
import { nextFollowUp } from '../../lib/dates.mjs';
import { findOrCreateCompany, findOrCreateContact, createLead, submissionsFromIp } from '../../lib/store.mjs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let payload;
  try { payload = await request.json(); } catch { return json({ ok: false, errors: { _: 'invalid JSON' } }, 400); }

  if (isHoneypot(payload)) return json({ ok: true, forward: 'skipped' }); // silently swallow bots

  const v = validateLead(payload);
  if (!v.ok) return json({ ok: false, errors: v.errors }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    if (await submissionsFromIp(env.DB, ip, 60) >= 5) return json({ ok: false, errors: { _: 'too many requests' } }, 429);
  } catch (e) { console.error('lead: rate-limit check failed', e); }

  let forward = 'skipped';
  if (env.FORMSPREE_URL) {
    try {
      const r = await fetch(env.FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      forward = r.ok ? 'ok' : `status ${r.status}`;
    } catch { forward = 'failed'; }
  }

  try {
    const companyId = await findOrCreateCompany(env.DB, v.data);
    const contactId = await findOrCreateContact(env.DB, companyId, v.data);
    await createLead(env.DB, {
      companyId, contactId, data: v.data,
      followUp: nextFollowUp(Date.now()), meta: { ip, forward },
    });
  } catch (e) {
    console.error('lead: D1 write failed', e);
    return json({ ok: false, errors: { _: 'storage failed' } }, 500);
  }
  return json({ ok: true, forward });
}
```

- [ ] **Step 3: Write the integration tests `tests/integration/lead.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { startPagesDev, startMockFormspree, d1Query } from './helpers.mjs';

const PAYLOAD = {
  company: 'Test Store GmbH', name: 'Anna Buyer', email: 'anna@test-store.example',
  country: 'Germany', businessType: 'Retailer', website: 'https://test-store.example',
  categories: ['Bags', 'Jewelry'], orderSize: 'Samples first', message: 'Integration test hello',
};
const post = (base, body) => fetch(`${base}/api/lead`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('lead capture end-to-end', async (t) => {
  const formspree = await startMockFormspree();
  const dev = await startPagesDev({ formspreeUrl: formspree.url, port: 8788 });
  t.after(() => { dev.stop(); formspree.close(); });

  await t.test('happy path: stores company, contact, lead, activity and forwards', async () => {
    const res = await post(dev.base, PAYLOAD);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).forward, 'ok');
    assert.equal(d1Query(dev.persist, 'SELECT COUNT(*) AS n FROM lead')[0].n, 1);
    const lead = d1Query(dev.persist, "SELECT status, product_interest, next_follow_up FROM lead")[0];
    assert.equal(lead.status, 'new');
    assert.equal(lead.product_interest, 'Bags, Jewelry');
    assert.match(lead.next_follow_up, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(d1Query(dev.persist, "SELECT COUNT(*) AS n FROM activity WHERE type='form_submission'")[0].n, 1);
    assert.equal(formspree.received.length, 1);
    assert.equal(formspree.received[0].email, 'anna@test-store.example');
  });

  await t.test('validation failure: 400 with field errors, nothing stored or forwarded', async () => {
    const res = await post(dev.base, { ...PAYLOAD, email: 'nope' });
    assert.equal(res.status, 400);
    assert.ok((await res.json()).errors.email);
    assert.equal(d1Query(dev.persist, 'SELECT COUNT(*) AS n FROM lead')[0].n, 1);
    assert.equal(formspree.received.length, 1);
  });

  await t.test('honeypot: 200 but nothing stored or forwarded', async () => {
    const res = await post(dev.base, { ...PAYLOAD, email: 'bot@evil.example', fax: 'yes' });
    assert.equal(res.status, 200);
    assert.equal(d1Query(dev.persist, 'SELECT COUNT(*) AS n FROM lead')[0].n, 1);
    assert.equal(formspree.received.length, 1);
  });

  await t.test('repeat submission from the same buyer reuses company and contact', async () => {
    await post(dev.base, { ...PAYLOAD, message: 'second inquiry' });
    assert.equal(d1Query(dev.persist, 'SELECT COUNT(*) AS n FROM company')[0].n, 1);
    assert.equal(d1Query(dev.persist, 'SELECT COUNT(*) AS n FROM contact')[0].n, 1);
    assert.equal(d1Query(dev.persist, 'SELECT COUNT(*) AS n FROM lead')[0].n, 2);
  });
});
```

- [ ] **Step 4: Write `tests/integration/lead-failures.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { startPagesDev, d1Query } from './helpers.mjs';

const PAYLOAD = {
  company: 'Fallback Test BV', name: 'Bo Buyer', email: 'bo@fallback.example',
  country: 'Netherlands', businessType: 'Retailer', categories: 'Bags',
};
const post = (base, body) => fetch(`${base}/api/lead`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('formspree down: lead still stored, forward recorded as failed', async (t) => {
  const dev = await startPagesDev({ formspreeUrl: 'http://127.0.0.1:9/dead', port: 8789 });
  t.after(() => dev.stop());
  const res = await post(dev.base, PAYLOAD);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).forward, 'failed');
  const meta = JSON.parse(d1Query(dev.persist, "SELECT meta FROM activity WHERE type='form_submission'")[0].meta);
  assert.equal(meta.forward, 'failed');
});

test('rate limit: sixth submission within the hour from one IP gets 429', async (t) => {
  const dev = await startPagesDev({ formspreeUrl: 'http://127.0.0.1:9/dead', port: 8790 });
  t.after(() => dev.stop());
  for (let i = 1; i <= 5; i++) {
    const r = await post(dev.base, { ...PAYLOAD, email: `buyer${i}@rate.example` });
    assert.equal(r.status, 200, `submission ${i} should pass`);
  }
  const sixth = await post(dev.base, { ...PAYLOAD, email: 'buyer6@rate.example' });
  assert.equal(sixth.status, 429);
});
```

- [ ] **Step 5: Run the integration suite**

Run: `npm run test:integration`
Expected: schema, seed, lead, lead-failures all PASS. (First run downloads workerd; allow a few minutes.)

- [ ] **Step 6: Commit**

```bash
git add lib/store.mjs functions/ tests/integration/
git commit -m "Add the dual-write lead capture endpoint with integration coverage"
```

---

### Task 5: Wire the site form to the new endpoint

**Files:**
- Modify: `index.html` (three surgical changes only: props block, `submit()`, honeypot input)

**Interfaces:**
- Consumes: `POST /api/lead` (Task 4).
- Produces: production form posts to `/api/lead` first, falls back to Formspree on any failure; bots caught by the `fax` honeypot. Props: `formEndpoint` default `"/api/lead"`, new `fallbackEndpoint` default `"https://formspree.io/f/xjybkzgj"`.

- [ ] **Step 1: Update the props block in `index.html`**

Find (inside the `data-props` JSON near the bottom):

```
  &quot;formEndpoint&quot;: {&quot;editor&quot;: &quot;text&quot;, &quot;default&quot;: &quot;https://formspree.io/f/xjybkzgj&quot;, &quot;tsType&quot;: &quot;string&quot;, &quot;section&quot;: &quot;Form: POST target for the line sheet request (Formspree: AWT line sheet requests); empty = demo mode&quot;}
```

Replace with:

```
  &quot;formEndpoint&quot;: {&quot;editor&quot;: &quot;text&quot;, &quot;default&quot;: &quot;/api/lead&quot;, &quot;tsType&quot;: &quot;string&quot;, &quot;section&quot;: &quot;Form: primary POST target for the line sheet request (the business OS capture endpoint); empty = demo mode&quot;},
  &quot;fallbackEndpoint&quot;: {&quot;editor&quot;: &quot;text&quot;, &quot;default&quot;: &quot;https://formspree.io/f/xjybkzgj&quot;, &quot;tsType&quot;: &quot;string&quot;, &quot;section&quot;: &quot;Form: fallback POST target used when the primary fails (Formspree: AWT line sheet requests); empty = no fallback&quot;}
```

- [ ] **Step 2: Replace the `submit()` method**

Find the existing `submit(e)` method and replace it with:

```js
  submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target); const data = {};
    fd.forEach((v, k) => { data[k] = data[k] === undefined ? v : [].concat(data[k], v); });
    // DUAL-WRITE CAPTURE: the primary endpoint stores the lead in the business
    // OS (and forwards to Formspree itself); if it fails in any way the browser
    // falls back to posting Formspree directly, so a lead is never lost.
    const url = this.props.formEndpoint ?? '';
    const fallback = this.props.fallbackEndpoint ?? '';
    const post = (u) => fetch(u, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (url) {
      this.setState({ sending: true });
      post(url).then((r) => { if (!r.ok) throw new Error('primary failed'); })
        .catch(() => (fallback ? post(fallback).catch(() => {}) : null))
        .finally(() => this.setState({ sending: false, formDone: true }));
    } else {
      console.log('Line sheet request (demo mode, no formEndpoint set):', data);
      this.setState({ formDone: true });
    }
  }
```

- [ ] **Step 3: Add the honeypot input**

Inside the line-sheet form, immediately before the submit `<button`, add:

```html
            <input name="fax" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0;width:0;border:0;padding:0"/>
```

- [ ] **Step 4: Verify the build still parses routes and nothing else changed**

Run: `node build.mjs && git diff --stat index.html`
Expected: build prints 6 routes; diff touches only the three regions above.

- [ ] **Step 5: Manual verification against the local stack**

Run: `npm run dev`, open `http://127.0.0.1:8788/wholesale`, submit the form with test data.
Expected: success message renders; `npx wrangler d1 execute awt-business-os --local --command "SELECT company_name FROM lead l LEFT JOIN company c ON c.id=l.company_id" --json` shows the row. Then, in DevTools → Network → set request blocking on `/api/lead`, submit again, and confirm the browser POSTs the Formspree fallback URL instead.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Point the line-sheet form at the capture endpoint with Formspree fallback"
```

---

## Milestone 3 — Admin

### Task 6: Access JWT verification + admin middleware

**Files:**
- Create: `lib/access-jwt.mjs`, `functions/api/admin/_middleware.js`
- Test: `tests/unit/access-jwt.test.mjs`

**Interfaces:**
- Consumes: env vars `ACCESS_TEAM_DOMAIN` (e.g. `https://<team>.cloudflareaccess.com`), `ACCESS_AUD` (Access app tag) — both unset in local dev, set in production (Task 12).
- Produces: `verifyAccessJwt(token, {teamDomain, aud, fetchImpl?, nowMs?}) → {ok:true, email} | {ok:false, reason}`; every `/api/admin/*` request is verified in production and passed through locally.

- [ ] **Step 1: Write failing tests `tests/unit/access-jwt.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt } from '../../lib/access-jwt.mjs';

const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function makeToken({ aud = 'aud1', iss, exp = Math.floor(Date.now() / 1000) + 3600, email = 'awthedev@gmail.com', tamper = false }) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const h = enc({ alg: 'RS256', kid: 'k1' });
  const p = enc({ aud, iss, exp, email });
  const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey,
    new TextEncoder().encode(`${h}.${p}`))).toString('base64url');
  const body = tamper ? enc({ aud, iss, exp, email: 'evil@example.com' }) : p;
  return { token: `${h}.${body}.${sig}`, fetchImpl: async () => Response.json({ keys: [jwk] }) };
}

// Distinct issuer per case: the module caches JWKS per team domain URL.
test('accepts a valid token', async () => {
  const iss = 'https://t-valid.cloudflareaccess.com';
  const { token, fetchImpl } = await makeToken({ iss });
  const v = await verifyAccessJwt(token, { teamDomain: iss, aud: 'aud1', fetchImpl });
  assert.deepEqual(v, { ok: true, email: 'awthedev@gmail.com' });
});

test('rejects wrong audience, expiry, tampering, and missing token', async () => {
  const iss = 'https://t-bad.cloudflareaccess.com';
  const good = await makeToken({ iss });
  assert.equal((await verifyAccessJwt(good.token, { teamDomain: iss, aud: 'other', fetchImpl: good.fetchImpl })).ok, false);

  const expired = await makeToken({ iss: 'https://t-exp.cloudflareaccess.com', exp: Math.floor(Date.now() / 1000) - 10 });
  assert.equal((await verifyAccessJwt(expired.token, { teamDomain: 'https://t-exp.cloudflareaccess.com', aud: 'aud1', fetchImpl: expired.fetchImpl })).ok, false);

  const forged = await makeToken({ iss: 'https://t-forge.cloudflareaccess.com', tamper: true });
  const v = await verifyAccessJwt(forged.token, { teamDomain: 'https://t-forge.cloudflareaccess.com', aud: 'aud1', fetchImpl: forged.fetchImpl });
  assert.deepEqual(v, { ok: false, reason: 'bad signature' });

  assert.equal((await verifyAccessJwt(null, { teamDomain: iss, aud: 'aud1', fetchImpl: good.fetchImpl })).ok, false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `lib/access-jwt.mjs` missing.

- [ ] **Step 3: Write `lib/access-jwt.mjs`**

```js
// Verify a Cloudflare Access JWT (RS256) against the team's published JWKS.
// Cloudflare injects the token as the Cf-Access-Jwt-Assertion header on every
// request that passed the Access login wall; verifying it here is defence in
// depth in case a route is ever exposed without Access in front.
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const dec = (s) => JSON.parse(new TextDecoder().decode(b64u(s)));

let jwks = { url: null, keys: null, fetchedAt: 0 };

export async function verifyAccessJwt(token, { teamDomain, aud, fetchImpl = fetch, nowMs = Date.now() }) {
  try {
    if (!token) return { ok: false, reason: 'missing token' };
    const [h64, p64, s64] = token.split('.');
    if (!s64) return { ok: false, reason: 'malformed token' };
    const header = dec(h64), payload = dec(p64);
    if (header.alg !== 'RS256') return { ok: false, reason: 'unexpected alg' };
    if (payload.iss !== teamDomain) return { ok: false, reason: 'wrong issuer' };
    if (![].concat(payload.aud ?? []).includes(aud)) return { ok: false, reason: 'wrong audience' };
    if ((payload.exp ?? 0) * 1000 < nowMs) return { ok: false, reason: 'expired' };

    const url = `${teamDomain}/cdn-cgi/access/certs`;
    if (jwks.url !== url || nowMs - jwks.fetchedAt > 3600000) {
      const r = await fetchImpl(url);
      if (!r.ok) return { ok: false, reason: 'jwks fetch failed' };
      jwks = { url, keys: (await r.json()).keys, fetchedAt: nowMs };
    }
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return { ok: false, reason: 'unknown key id' };
    const key = await crypto.subtle.importKey('jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key,
      b64u(s64), new TextEncoder().encode(`${h64}.${p64}`));
    return valid ? { ok: true, email: payload.email } : { ok: false, reason: 'bad signature' };
  } catch {
    return { ok: false, reason: 'verification error' };
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `functions/api/admin/_middleware.js`**

```js
// Gate for every /api/admin/* route. In production Cloudflare Access sits in
// front and injects the JWT; we verify it anyway (defence in depth). Local
// wrangler dev has no Access and no ACCESS_* vars, so requests pass through.
import { verifyAccessJwt } from '../../../lib/access-jwt.mjs';

export async function onRequest({ request, env, next }) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return next();
  const v = await verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'),
    { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD });
  if (!v.ok) {
    return new Response(JSON.stringify({ error: 'forbidden', reason: v.reason }),
      { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return next();
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/access-jwt.mjs functions/api/admin/_middleware.js tests/unit/access-jwt.test.mjs
git commit -m "Verify Cloudflare Access JWTs in front of the admin API"
```

---

### Task 7: Admin JSON API

**Files:**
- Create: `functions/api/admin/overview.js`, `functions/api/admin/leads.js`, `functions/api/admin/leads/[id].js`, `functions/api/admin/leads/[id]/activities.js`, `functions/api/admin/products.js`, `functions/api/admin/products/[id].js`
- Test: `tests/integration/admin-api.test.mjs`

**Interfaces:**
- Consumes: Task 4 `lib/store.mjs` (`LEAD_ROW_SQL`), Task 3 (`LEAD_STATUSES`, `witaDate`), Task 6 middleware (transparent locally).
- Produces (all JSON):
  - `GET /api/admin/overview` → `{today, briefing|null, dueLeads[], newLeads[], silentLeads[], products:{total, priced}}`
  - `GET /api/admin/leads?status=` → `{leads[]}` (lead rows carry `company_name, country, contact_name, contact_email`)
  - `GET /api/admin/leads/:id` → `{lead, activities[]}` · `PATCH` `{status?, next_follow_up?}` → `{ok:true}` (writes a `status_change` activity)
  - `POST /api/admin/leads/:id/activities` `{type, body}` → `{activityId}`
  - `GET /api/admin/products` → `{products[], total, priced}` · `PATCH /api/admin/products/:id` (whitelisted fields) → `{ok:true}`

- [ ] **Step 1: Write `functions/api/admin/overview.js`**

```js
// The Today screen's data: the latest briefing plus only the exceptions.
import { witaDate } from '../../../lib/dates.mjs';
import { LEAD_ROW_SQL } from '../../../lib/store.mjs';

export async function onRequestGet({ env }) {
  const today = witaDate(Date.now());
  const [briefing, due, fresh, silent, products] = await Promise.all([
    env.DB.prepare('SELECT date, body FROM briefing ORDER BY date DESC LIMIT 1').first(),
    env.DB.prepare(`${LEAD_ROW_SQL} WHERE l.next_follow_up <= ?
      AND l.status NOT IN ('order','repeat','lost') ORDER BY l.next_follow_up`).bind(today).all(),
    env.DB.prepare(`${LEAD_ROW_SQL} WHERE l.status = 'new' ORDER BY l.created_at DESC`).all(),
    env.DB.prepare(`${LEAD_ROW_SQL} WHERE l.status = 'line_sheet_sent'
      AND l.updated_at <= datetime('now', '-7 days')
      AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.lead_id = l.id
        AND a.type IN ('email_in','whatsapp') AND a.created_at > datetime('now', '-7 days'))
      ORDER BY l.updated_at`).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN wholesale_price_cents IS NOT NULL AND moq IS NOT NULL THEN 1 ELSE 0 END) AS priced
      FROM product WHERE status = 'active'`).first(),
  ]);
  return Response.json({
    today, briefing: briefing ?? null,
    dueLeads: due.results, newLeads: fresh.results, silentLeads: silent.results,
    products: { total: products.total, priced: products.priced ?? 0 },
  });
}
```

- [ ] **Step 2: Write `functions/api/admin/leads.js`**

```js
import { LEAD_ROW_SQL } from '../../../lib/store.mjs';
import { LEAD_STATUSES } from '../../../lib/validate.mjs';

export async function onRequestGet({ request, env }) {
  const status = new URL(request.url).searchParams.get('status');
  if (status && !LEAD_STATUSES.includes(status)) {
    return Response.json({ error: 'unknown status' }, { status: 400 });
  }
  const stmt = status
    ? env.DB.prepare(`${LEAD_ROW_SQL} WHERE l.status = ? ORDER BY l.updated_at DESC`).bind(status)
    : env.DB.prepare(`${LEAD_ROW_SQL} ORDER BY l.updated_at DESC`);
  return Response.json({ leads: (await stmt.all()).results });
}
```

- [ ] **Step 3: Write `functions/api/admin/leads/[id].js`**

```js
import { LEAD_ROW_SQL } from '../../../../lib/store.mjs';
import { LEAD_STATUSES } from '../../../../lib/validate.mjs';

export async function onRequestGet({ env, params }) {
  const lead = await env.DB.prepare(`${LEAD_ROW_SQL} WHERE l.id = ?`).bind(params.id).first();
  if (!lead) return Response.json({ error: 'not found' }, { status: 404 });
  const acts = await env.DB.prepare(
    'SELECT id, type, body, meta, created_at FROM activity WHERE lead_id = ? ORDER BY created_at DESC, id DESC')
    .bind(params.id).all();
  return Response.json({ lead, activities: acts.results });
}

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: 'invalid JSON' }, { status: 400 });
  const lead = await env.DB.prepare('SELECT id, status FROM lead WHERE id = ?').bind(params.id).first();
  if (!lead) return Response.json({ error: 'not found' }, { status: 404 });

  const updates = [], binds = [];
  if (body.status !== undefined) {
    if (!LEAD_STATUSES.includes(body.status)) return Response.json({ error: 'unknown status' }, { status: 400 });
    updates.push('status = ?'); binds.push(body.status);
  }
  if (body.next_follow_up !== undefined) {
    if (body.next_follow_up !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.next_follow_up)) {
      return Response.json({ error: 'next_follow_up must be YYYY-MM-DD or null' }, { status: 400 });
    }
    updates.push('next_follow_up = ?'); binds.push(body.next_follow_up);
  }
  if (!updates.length) return Response.json({ error: 'nothing to update' }, { status: 400 });

  await env.DB.prepare(`UPDATE lead SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...binds, params.id).run();
  if (body.status !== undefined && body.status !== lead.status) {
    await env.DB.prepare("INSERT INTO activity (lead_id, type, body) VALUES (?, 'status_change', ?)")
      .bind(params.id, `${lead.status} → ${body.status}`).run();
  }
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Write `functions/api/admin/leads/[id]/activities.js`**

```js
const TYPES = ['note', 'email_out', 'email_in', 'whatsapp'];

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!body || !TYPES.includes(body.type) || !text || text.length > 5000) {
    return Response.json({ error: 'type must be one of note/email_out/email_in/whatsapp with a non-empty body ≤ 5000 chars' }, { status: 400 });
  }
  const lead = await env.DB.prepare('SELECT id, company_id FROM lead WHERE id = ?').bind(params.id).first();
  if (!lead) return Response.json({ error: 'not found' }, { status: 404 });
  const r = await env.DB.prepare('INSERT INTO activity (lead_id, company_id, type, body) VALUES (?, ?, ?, ?)')
    .bind(lead.id, lead.company_id, body.type, text).run();
  await env.DB.prepare("UPDATE lead SET updated_at = datetime('now') WHERE id = ?").bind(lead.id).run();
  return Response.json({ activityId: r.meta.last_row_id });
}
```

- [ ] **Step 5: Write `functions/api/admin/products.js`**

```js
export async function onRequestGet({ env }) {
  const r = await env.DB.prepare('SELECT * FROM product ORDER BY category, name').all();
  const priced = r.results.filter((p) => p.wholesale_price_cents != null && p.moq != null).length;
  return Response.json({ products: r.results, total: r.results.length, priced });
}
```

- [ ] **Step 6: Write `functions/api/admin/products/[id].js`**

```js
// Commercial fields only: presentation fields stay mastered in index.html
// (the drift check compares them), so they are not editable here.
const EDITABLE = ['sku', 'hs_code', 'moq', 'wholesale_price_cents', 'rrp_cents',
  'currency', 'status', 'weight', 'lead_time', 'notes'];
const INT_FIELDS = ['moq', 'wholesale_price_cents', 'rrp_cents'];
const PRODUCT_STATUSES = ['active', 'draft', 'retired'];

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'invalid JSON' }, { status: 400 });
  const updates = [], binds = [];
  for (const [k, v] of Object.entries(body)) {
    if (!EDITABLE.includes(k)) return Response.json({ error: `field not editable: ${k}` }, { status: 400 });
    if (INT_FIELDS.includes(k) && v !== null && (!Number.isInteger(v) || v < 0)) {
      return Response.json({ error: `${k} must be a non-negative integer or null` }, { status: 400 });
    }
    if (k === 'status' && !PRODUCT_STATUSES.includes(v)) {
      return Response.json({ error: 'status must be active/draft/retired' }, { status: 400 });
    }
    updates.push(`${k} = ?`); binds.push(v);
  }
  if (!updates.length) return Response.json({ error: 'nothing to update' }, { status: 400 });
  const r = await env.DB.prepare(`UPDATE product SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...binds, params.id).run();
  if (!r.meta.changes) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 7: Write the integration test `tests/integration/admin-api.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { startPagesDev, startMockFormspree } from './helpers.mjs';

const PAYLOAD = {
  company: 'Concept Store Berlin', name: 'Casey Buyer', email: 'casey@concept.example',
  country: 'Germany', businessType: 'Retailer', categories: ['Bags'], orderSize: 'Samples first',
  message: 'Please send the line sheet',
};
const api = (base, path, init) => fetch(`${base}/api/admin${path}`, init).then(async (r) => ({ status: r.status, body: await r.json() }));
const patch = (base, path, body) => api(base, path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('admin API end-to-end', async (t) => {
  const formspree = await startMockFormspree();
  const dev = await startPagesDev({ formspreeUrl: formspree.url, port: 8791 });
  t.after(() => { dev.stop(); formspree.close(); });

  await t.test('overview on a fresh database: 30 unpriced products, no leads, no briefing', async () => {
    const { status, body } = await api(dev.base, '/overview');
    assert.equal(status, 200);
    assert.equal(body.briefing, null);
    assert.deepEqual(body.products, { total: 30, priced: 0 });
    assert.equal(body.newLeads.length, 0);
  });

  await t.test('a captured lead appears in the list and in overview newLeads', async () => {
    await fetch(`${dev.base}/api/lead`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PAYLOAD) });
    const list = await api(dev.base, '/leads');
    assert.equal(list.body.leads.length, 1);
    assert.equal(list.body.leads[0].company_name, 'Concept Store Berlin');
    assert.equal((await api(dev.base, '/overview')).body.newLeads.length, 1);
  });

  await t.test('status change writes an activity; bad status is rejected', async () => {
    assert.equal((await patch(dev.base, '/leads/1', { status: 'nonsense' })).status, 400);
    assert.equal((await patch(dev.base, '/leads/1', { status: 'line_sheet_sent' })).status, 200);
    const detail = await api(dev.base, '/leads/1');
    assert.equal(detail.body.lead.status, 'line_sheet_sent');
    assert.deepEqual(detail.body.activities.map((a) => a.type).sort(), ['form_submission', 'status_change']);
  });

  await t.test('notes attach to the timeline; unknown types are rejected', async () => {
    const bad = await api(dev.base, '/leads/1/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'carrier_pigeon', body: 'hi' }) });
    assert.equal(bad.status, 400);
    const ok = await api(dev.base, '/leads/1/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'note', body: 'Spoke on WhatsApp, wants bags' }) });
    assert.equal(ok.status, 200);
    assert.equal((await api(dev.base, '/leads/1')).body.activities.length, 3);
  });

  await t.test('a due follow-up surfaces in overview dueLeads', async () => {
    await patch(dev.base, '/leads/1', { next_follow_up: '2020-01-01' });
    const { body } = await api(dev.base, '/overview');
    assert.equal(body.dueLeads.length, 1);
    assert.equal(body.dueLeads[0].id, 1);
  });

  await t.test('pricing a product moves the priced counter; junk fields bounce', async () => {
    assert.equal((await patch(dev.base, '/products/placemats', { name: 'Renamed' })).status, 400);
    assert.equal((await patch(dev.base, '/products/placemats', { wholesale_price_cents: 'cheap' })).status, 400);
    assert.equal((await patch(dev.base, '/products/placemats', { wholesale_price_cents: 4500, moq: 6, rrp_cents: 12900 })).status, 200);
    const prods = await api(dev.base, '/products');
    assert.equal(prods.body.priced, 1);
    assert.equal((await patch(dev.base, '/products/nope', { moq: 1 })).status, 404);
  });
});
```

- [ ] **Step 8: Run the integration suite**

Run: `npm run test:integration`
Expected: all files PASS.

- [ ] **Step 9: Commit**

```bash
git add functions/api/admin/ tests/integration/admin-api.test.mjs
git commit -m "Add the admin JSON API for overview, leads and products"
```

---

### Task 8: Admin UI — shell and Leads screens

**Files:**
- Create: `admin/index.html`, `admin/lib.mjs`, `admin/app.mjs`
- Test: `tests/unit/admin-lib.test.mjs`

**Interfaces:**
- Consumes: Task 7 endpoints.
- Produces: `/admin/` SPA with hash routes `#/today`, `#/leads`, `#/leads/<id>`, `#/products`. `admin/lib.mjs` exports pure helpers used by `app.mjs` and Tasks 9–10: `esc(s)`, `fmtDate(iso)`, `fmtDateTime(iso)`, `statusLabel(s)`, `toCents(str) → int|null` (NaN-safe), `fromCents(cents) → string`, `groupByStatus(leads) → Map`.

- [ ] **Step 1: Write failing tests `tests/unit/admin-lib.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, statusLabel, toCents, fromCents, groupByStatus } from '../../admin/lib.mjs';

test('esc neutralizes HTML', () => {
  assert.equal(esc('<b>&"x"</b>'), '&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
  assert.equal(esc(null), '');
});

test('statusLabel humanizes pipeline statuses', () => {
  assert.equal(statusLabel('line_sheet_sent'), 'Line sheet sent');
  assert.equal(statusLabel('new'), 'New');
});

test('money round-trips through cents and rejects junk', () => {
  assert.equal(toCents('6.50'), 650);
  assert.equal(toCents('6,50'), 650);   // European decimal comma
  assert.equal(toCents(' 19 '), 1900);
  assert.equal(toCents(''), null);
  assert.equal(toCents('abc'), undefined);   // undefined = invalid, caller shows an error
  assert.equal(toCents('-4'), undefined);
  assert.equal(fromCents(650), '6.50');
  assert.equal(fromCents(null), '');
});

test('groupByStatus keeps pipeline order and drops empty statuses', () => {
  const g = groupByStatus([{ id: 1, status: 'new' }, { id: 2, status: 'quote' }, { id: 3, status: 'new' }]);
  assert.deepEqual([...g.keys()], ['new', 'quote']);
  assert.equal(g.get('new').length, 2);
});
```

- [ ] **Step 2: Run to verify failure, then write `admin/lib.mjs`**

Run: `npm test` → FAIL. Then create:

```js
// Pure helpers for the admin UI. No DOM access here — everything is testable
// under node --test.
export const LEAD_STATUSES =
  ['new', 'contacted', 'replied', 'line_sheet_sent', 'sample', 'quote', 'order', 'repeat', 'lost'];

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '—');
export const fmtDateTime = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '—');

export const statusLabel = (s) => {
  const t = String(s ?? '').replaceAll('_', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// '6.50' | '6,50' | '19' -> integer cents; '' -> null; junk/negative -> undefined.
export function toCents(str) {
  const t = String(str ?? '').trim();
  if (t === '') return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return undefined;
  const [whole, frac = ''] = t.replace(',', '.').split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

export const fromCents = (cents) =>
  cents == null ? '' : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

export function groupByStatus(leads) {
  const g = new Map();
  for (const s of LEAD_STATUSES) {
    const rows = leads.filter((l) => l.status === s);
    if (rows.length) g.set(s, rows);
  }
  return g;
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: Write `admin/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>AWT Business OS</title>
<style>
  :root { --paper:#F7F1E5; --panel:#FDFAF2; --ink:#34291D; --soft:#6D5B45; --line:#DACBAE;
          --red:#8E2321; --gold:#C99435; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:16px/1.55 Karla, 'Helvetica Neue', sans-serif; }
  header { background:#2A211A; color:#F2E8D5; padding:14px clamp(16px,3vw,32px);
           display:flex; align-items:center; gap:22px; flex-wrap:wrap; }
  header .brand { font-family:Georgia, 'Young Serif', serif; font-size:19px; }
  header .brand small { display:block; font:600 9.5px Archivo, sans-serif; letter-spacing:.2em;
                        text-transform:uppercase; color:var(--gold); }
  nav a { color:#EAE0CC; text-decoration:none; font:600 12.5px Archivo, sans-serif;
          letter-spacing:.08em; text-transform:uppercase; margin-right:16px; padding-bottom:4px; }
  nav a.on { border-bottom:2px solid var(--red); color:#fff; }
  main { max-width:1100px; margin:0 auto; padding:clamp(18px,3vw,32px); }
  h1 { font-family:Georgia, serif; font-weight:400; font-size:clamp(24px,3vw,32px); margin:0 0 4px; }
  h2 { font:600 12px Archivo, sans-serif; letter-spacing:.14em; text-transform:uppercase;
       color:var(--soft); margin:26px 0 10px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:4px;
          padding:14px 16px; margin-bottom:10px; }
  .card a { color:var(--red); text-decoration:none; font-weight:600; }
  .muted { color:var(--soft); font-size:13.5px; }
  .pill { display:inline-block; font:600 10.5px Archivo, sans-serif; letter-spacing:.08em;
          text-transform:uppercase; border:1px solid var(--line); border-radius:999px;
          padding:3px 10px; color:var(--soft); }
  .pill.red { border-color:var(--red); color:var(--red); }
  .chips { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0; }
  .chips button { background:transparent; border:1px solid var(--line); border-radius:999px;
          padding:6px 14px; font:500 13px Archivo, sans-serif; color:var(--soft); cursor:pointer; }
  .chips button.on { background:var(--ink); color:var(--paper); border-color:var(--ink); }
  table { width:100%; border-collapse:collapse; background:var(--panel);
          border:1px solid var(--line); font-size:14px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font:600 11px Archivo, sans-serif; letter-spacing:.1em; text-transform:uppercase; color:var(--soft); }
  input, select, textarea, .btn { font:inherit; color:var(--ink); background:#fff;
          border:1px solid var(--line); border-radius:3px; padding:7px 9px; }
  input.num { width:90px; } input.sm { width:120px; }
  .btn { background:var(--red); color:#F7F1E5; border:none; cursor:pointer;
         font:600 12px Archivo, sans-serif; letter-spacing:.08em; text-transform:uppercase; padding:9px 16px; }
  .btn.ghost { background:transparent; color:var(--red); border:1px solid var(--red); }
  .row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .timeline { border-left:2px solid var(--line); margin:10px 0 0 6px; padding-left:16px; }
  .timeline .item { margin-bottom:12px; }
  pre.brief { white-space:pre-wrap; font:inherit; margin:0; }
  #banner { display:none; background:var(--red); color:#F7F1E5; padding:10px 16px; }
  .tablewrap { overflow-x:auto; }
  .empty { text-align:center; padding:40px 0; color:var(--soft); font-family:Georgia, serif;
           font-size:19px; }
</style>
</head>
<body>
<header>
  <div class="brand">Alana Wina Trudi<small>Business OS</small></div>
  <nav>
    <a href="#/today" data-nav="today">Today</a>
    <a href="#/leads" data-nav="leads">Leads</a>
    <a href="#/products" data-nav="products">Products</a>
  </nav>
</header>
<div id="banner"></div>
<main id="view"><p class="muted">Loading…</p></main>
<script type="module" src="/admin/app.mjs"></script>
</body>
</html>
```

- [ ] **Step 4: Write `admin/app.mjs`** (shell, router, Today placeholder until Task 10, Leads screens now)

```js
import { esc, fmtDate, fmtDateTime, statusLabel, toCents, fromCents, groupByStatus, LEAD_STATUSES } from '/admin/lib.mjs';

const view = document.getElementById('view');
const banner = document.getElementById('banner');

async function api(path, init) {
  banner.style.display = 'none';
  const r = await fetch('/api/admin' + path, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    banner.textContent = `Request failed (${r.status}): ${body.error ?? 'unknown error'}`;
    banner.style.display = 'block';
    throw new Error(body.error ?? String(r.status));
  }
  return body;
}
const jsonInit = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const leadCard = (l, extra = '') => `
  <div class="card">
    <a href="#/leads/${l.id}">${esc(l.company_name ?? 'Unknown company')}</a>
    <span class="pill">${esc(statusLabel(l.status))}</span> ${extra}
    <div class="muted">${esc(l.contact_name ?? '')} · ${esc(l.contact_email ?? '')} · ${esc(l.country ?? '—')}
      · interest: ${esc(l.product_interest ?? '—')} · follow-up ${esc(fmtDate(l.next_follow_up))}</div>
  </div>`;

// ---- Leads list -----------------------------------------------------------
async function renderLeads(filter) {
  const { leads } = await api('/leads' + (filter ? `?status=${filter}` : ''));
  const chips = ['', ...LEAD_STATUSES].map((s) =>
    `<button data-chip="${s}" class="${s === (filter ?? '') ? 'on' : ''}">${s ? esc(statusLabel(s)) : 'All'}</button>`).join('');
  const groups = [...groupByStatus(leads)].map(([s, rows]) =>
    `<h2>${esc(statusLabel(s))} · ${rows.length}</h2>` + rows.map((l) => leadCard(l)).join('')).join('');
  view.innerHTML = `<h1>Leads</h1><div class="chips">${chips}</div>` +
    (leads.length ? groups : '<div class="empty">No leads here yet. They will arrive through the line-sheet form.</div>');
  view.querySelectorAll('[data-chip]').forEach((b) =>
    b.addEventListener('click', () => renderLeads(b.dataset.chip || undefined)));
}

// ---- Lead detail ----------------------------------------------------------
async function renderLead(id) {
  const { lead, activities } = await api(`/leads/${id}`);
  const statusOpts = LEAD_STATUSES.map((s) =>
    `<option value="${s}" ${s === lead.status ? 'selected' : ''}>${esc(statusLabel(s))}</option>`).join('');
  const acts = activities.map((a) => `
    <div class="item"><span class="pill">${esc(statusLabel(a.type))}</span>
      <span class="muted">${esc(fmtDateTime(a.created_at))}</span>
      <div>${esc(a.body ?? '')}</div></div>`).join('');
  view.innerHTML = `
    <p><a href="#/leads" class="muted">← All leads</a></p>
    <h1>${esc(lead.company_name ?? 'Unknown company')}</h1>
    <p class="muted">${esc(lead.contact_name ?? '')} · ${esc(lead.contact_email ?? '')} · ${esc(lead.country ?? '—')}
      · source ${esc(lead.source)} · interest ${esc(lead.product_interest ?? '—')} · size ${esc(lead.order_size ?? '—')}</p>
    <div class="card"><div class="row">
      <label>Status <select id="f-status">${statusOpts}</select></label>
      <label>Next follow-up <input type="date" id="f-fup" value="${esc(lead.next_follow_up ?? '')}"/></label>
      <button class="btn" id="f-save">Save</button>
    </div></div>
    <div class="card">
      <div class="row">
        <select id="a-type"><option value="note">Note</option><option value="email_out">Email sent</option>
          <option value="email_in">Email received</option><option value="whatsapp">WhatsApp</option></select>
        <input id="a-body" class="sm" style="flex:1;min-width:220px" placeholder="Log what happened…"/>
        <button class="btn ghost" id="a-add">Add</button>
      </div>
    </div>
    <h2>Timeline</h2><div class="timeline">${acts || '<p class="muted">Nothing yet.</p>'}</div>`;
  document.getElementById('f-save').addEventListener('click', async () => {
    await api(`/leads/${id}`, jsonInit('PATCH', {
      status: document.getElementById('f-status').value,
      next_follow_up: document.getElementById('f-fup').value || null,
    }));
    renderLead(id);
  });
  document.getElementById('a-add').addEventListener('click', async () => {
    const body = document.getElementById('a-body').value.trim();
    if (!body) return;
    await api(`/leads/${id}/activities`, jsonInit('POST', { type: document.getElementById('a-type').value, body }));
    renderLead(id);
  });
}

// ---- Today / Products (full versions land in Tasks 9–10) ------------------
async function renderToday() { view.innerHTML = '<h1>Today</h1><p class="muted">Coming in Task 10.</p>'; }
async function renderProducts() { view.innerHTML = '<h1>Products</h1><p class="muted">Coming in Task 9.</p>'; }

// ---- Router ---------------------------------------------------------------
const routes = [
  [/^#\/today$/, () => renderToday()],
  [/^#\/leads$/, () => renderLeads()],
  [/^#\/leads\/(\d+)$/, (m) => renderLead(m[1])],
  [/^#\/products$/, () => renderProducts()],
];
function route() {
  const h = location.hash || '#/today';
  document.querySelectorAll('[data-nav]').forEach((a) =>
    a.classList.toggle('on', h.startsWith('#/' + a.dataset.nav)));
  for (const [re, fn] of routes) { const m = h.match(re); if (m) return fn(m).catch(() => {}); }
  location.hash = '#/today';
}
addEventListener('hashchange', route);
route();

export { toCents, fromCents }; // re-export keeps module graph warm for Tasks 9–10
```

- [ ] **Step 5: Manual verification**

Temporarily add `'admin'` to the ASSETS array in `build.mjs` only if Task 11 has not landed yet — otherwise run as-is:
`npm run dev`, open `http://127.0.0.1:8788/admin/`, then: submit a lead through `/wholesale`, see it under Leads → New, open it, change status to Line sheet sent, set a follow-up date, add a note, confirm the timeline shows form submission + status change + note. Check phone width in devtools responsive mode.

- [ ] **Step 6: Commit**

```bash
git add admin/ tests/unit/admin-lib.test.mjs build.mjs
git commit -m "Add the admin shell with the Leads list and detail screens"
```

---

### Task 9: Admin UI — Products screen

**Files:**
- Modify: `admin/app.mjs` (replace the `renderProducts` stub)

**Interfaces:**
- Consumes: Task 7 products endpoints; Task 8 helpers (`toCents`, `fromCents`, `esc`).
- Produces: `#/products` — pricing table with per-row save and a priced-count banner.

- [ ] **Step 1: Replace `renderProducts` in `admin/app.mjs`**

```js
async function renderProducts() {
  const { products, total, priced } = await api('/products');
  const rows = products.map((p) => `
    <tr data-id="${esc(p.id)}">
      <td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category)} · ${esc(p.dims ?? '—')}</div></td>
      <td><input class="sm" data-f="sku" value="${esc(p.sku ?? '')}"/></td>
      <td><input class="num" data-f="wholesale_price_cents" inputmode="decimal" value="${esc(fromCents(p.wholesale_price_cents))}" placeholder="EUR"/></td>
      <td><input class="num" data-f="rrp_cents" inputmode="decimal" value="${esc(fromCents(p.rrp_cents))}" placeholder="EUR"/></td>
      <td><input class="num" data-f="moq" inputmode="numeric" value="${esc(p.moq ?? '')}"/></td>
      <td><input class="sm" data-f="hs_code" value="${esc(p.hs_code ?? '')}"/></td>
      <td><input class="sm" data-f="lead_time" value="${esc(p.lead_time ?? '')}"/></td>
      <td>${p.wholesale_price_cents != null && p.moq != null
            ? '<span class="pill">Priced</span>' : '<span class="pill red">Needs price</span>'}
        <button class="btn ghost" data-save>Save</button></td>
    </tr>`).join('');
  view.innerHTML = `<h1>Products</h1>
    <p class="muted">${priced} of ${total} priced · prices in EUR · presentation fields are edited on the site, not here</p>
    <div class="tablewrap"><table>
      <tr><th>Product</th><th>SKU</th><th>Wholesale</th><th>RRP</th><th>MOQ</th><th>HS code</th><th>Lead time</th><th></th></tr>
      ${rows}</table></div>`;
  view.querySelectorAll('[data-save]').forEach((btn) => btn.addEventListener('click', async () => {
    const tr = btn.closest('tr');
    const val = (f) => tr.querySelector(`[data-f="${f}"]`).value.trim();
    const wholesale = toCents(val('wholesale_price_cents'));
    const rrp = toCents(val('rrp_cents'));
    const moqRaw = val('moq');
    const moq = moqRaw === '' ? null : (/^\d+$/.test(moqRaw) ? Number(moqRaw) : undefined);
    if (wholesale === undefined || rrp === undefined || moq === undefined) {
      banner.textContent = 'Prices must be plain numbers like 6.50; MOQ a whole number.';
      banner.style.display = 'block';
      return;
    }
    await api(`/products/${tr.dataset.id}`, jsonInit('PATCH', {
      sku: val('sku') || null, wholesale_price_cents: wholesale, rrp_cents: rrp,
      moq, hs_code: val('hs_code') || null, lead_time: val('lead_time') || null,
    }));
    renderProducts();
  }));
}
```

- [ ] **Step 2: Manual verification**

`npm run dev` → `#/products`: shows 30 rows, all "Needs price". Price the placemats (wholesale 45, RRP 129, MOQ 6) → row flips to "Priced", banner shows 1 of 30. Enter `abc` as a price → error banner, nothing saved. Confirm `6,50` (comma) saves as 6.50.

- [ ] **Step 3: Commit**

```bash
git add admin/app.mjs
git commit -m "Add the Products pricing screen to the admin"
```

---

### Task 10: Admin UI — Today screen

**Files:**
- Modify: `admin/app.mjs` (replace the `renderToday` stub)

**Interfaces:**
- Consumes: `GET /api/admin/overview` (Task 7).
- Produces: `#/today` — briefing + exception queues + explicit "nothing needs you" empty state.

- [ ] **Step 1: Replace `renderToday` in `admin/app.mjs`**

```js
async function renderToday() {
  const d = await api('/overview');
  const quiet = !d.dueLeads.length && !d.newLeads.length && !d.silentLeads.length;
  const section = (title, rows, extra) => rows.length
    ? `<h2>${title} · ${rows.length}</h2>` + rows.map((l) => leadCard(l, extra)).join('') : '';
  view.innerHTML = `<h1>Today</h1><p class="muted">${esc(d.today)} · ${d.products.priced} of ${d.products.total} products priced</p>
    ${d.briefing
      ? `<div class="card"><h2 style="margin-top:0">Briefing · ${esc(d.briefing.date)}</h2><pre class="brief">${esc(d.briefing.body)}</pre></div>`
      : '<div class="card muted">No briefing yet. The scheduled Claude task writes one each morning (business-os skill).</div>'}
    ${section('Follow-ups due', d.dueLeads, '<span class="pill red">Due</span>')}
    ${section('New, untriaged', d.newLeads, '')}
    ${section('Silent after line sheet', d.silentLeads, '<span class="pill red">Silent</span>')}
    ${quiet ? '<div class="empty">Nothing needs you today.</div>' : ''}`;
}
```

- [ ] **Step 2: Manual verification**

`npm run dev` → `#/today` on a fresh DB: "Nothing needs you today." Submit a lead → appears under "New, untriaged". Set its follow-up to yesterday (via lead detail) → appears under "Follow-ups due". Insert a briefing locally and confirm it renders:

```bash
npx wrangler d1 execute awt-business-os --local --command "INSERT INTO briefing (date, body) VALUES (date('now'), 'Test briefing.\n- One line.')"
```

- [ ] **Step 3: Commit**

```bash
git add admin/app.mjs
git commit -m "Add the Today screen with briefing and exception queues"
```

---

## Milestone 4 — Ship & operate

### Task 11: Build integration + README

**Files:**
- Modify: `build.mjs` (one line), `README.md`

**Interfaces:**
- Consumes: everything prior.
- Produces: `dist/` contains `admin/`; README documents the OS. (CI build command itself changes in Task 12.)

- [ ] **Step 1: Add `'admin'` to the ASSETS array in `build.mjs`** (skip if done in Task 8)

```js
const ASSETS = ['support.js', 'image-slot.js', 'bead-band.svg', 'logo.png', 'logo-180.png',
                'logo-32.png', 'og-1200x630.jpg', 'robots.txt', 'sitemap.xml', '_redirects', 'images', 'admin'];
```

- [ ] **Step 2: Verify**

Run: `npm test && node build.mjs && ls dist/admin`
Expected: unit tests pass; `index.html app.mjs lib.mjs` listed.

- [ ] **Step 3: Update `README.md`**

Append after the Deployment section:

```markdown
## Business OS (SP-1 Lead Desk)

The same Pages project hosts the founder's control center:

- `admin/` — dashboard at `/admin/` (Today, Leads, Products), gated by Cloudflare Access
- `functions/api/lead.js` — public form endpoint; writes to D1 and forwards to Formspree
- `functions/api/admin/` — JSON API behind Access
- `schema/` — D1 migrations (`npx wrangler d1 migrations apply awt-business-os --remote`)
- `.claude/skills/business-os/` — how Claude operates the database (briefings, drafts; never sends)

Commercial and buyer data live only in the `awt-business-os` D1 database, never in this
public repo. Local stack: `npm run dev`. Tests: `npm test` (unit, also run by the Pages
build) and `npm run test:integration` (local only). Site/DB product drift:
`node scripts/drift-check.mjs`. Design: `docs/superpowers/specs/2026-08-12-one-person-business-os-design.md`.
```

Also delete the stale "No build command; output directory is the repo root" claim in the Deployment section and replace that sentence with: "Build command `node --test tests/unit/ && node build.mjs`, output directory `dist/`."

- [ ] **Step 4: Commit**

```bash
git add build.mjs README.md
git commit -m "Ship the admin app in the build and document the Business OS"
```

---

### Task 12: Provision, deploy, verify (founder-assisted)

**Files:**
- Modify: `wrangler.toml` (paste the real `database_id`)

Steps marked **[founder]** need Anita's Cloudflare login in a browser; everything else runs in the terminal.

- [ ] **Step 1: Authenticate wrangler** — run `npx wrangler login` **[founder approves in browser]**

For day-to-day operation after setup (the business-os skill, the scheduled
briefing), prefer a **scoped API token** over the full-account login, per the
spec's blast-radius mitigation: dashboard → My Profile → API Tokens → Create
Token → permissions `Account · D1 · Edit` only. Store it as
`export CLOUDFLARE_API_TOKEN=…` in `~/.zshrc` (never in the repo); wrangler
uses it automatically and `wrangler logout` can then drop the broad OAuth grant.

- [ ] **Step 2: Create the production database**

```bash
npx wrangler d1 create awt-business-os
```

Paste the returned `database_id` into `wrangler.toml`, replacing `PASTE-FROM-WRANGLER-D1-CREATE`. Commit:

```bash
git add wrangler.toml && git commit -m "Bind the production D1 database"
```

- [ ] **Step 3: Apply migrations remotely**

```bash
npx wrangler d1 migrations apply awt-business-os --remote
```

Verify: `npx wrangler d1 execute awt-business-os --remote --command "SELECT COUNT(*) AS n FROM product" --json` → 30.

- [ ] **Step 4: [founder] Configure the Pages project** (dashboard → Workers & Pages → awt-beads):
  - Settings → Build: confirm build command is `node build.mjs`; change it to `node --test tests/unit/ && node build.mjs`; output dir stays `dist`.
  - Settings → Variables and secrets (Production **and** Preview): add `FORMSPREE_URL` = `https://formspree.io/f/xjybkzgj`. (`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` come in Step 6.)

- [ ] **Step 5: [founder] Create the Access application** (dashboard → Zero Trust → Access → Applications → Add → Self-hosted):
  - Application name: `AWT Business OS`. Session duration: 1 week.
  - Public hostnames: `beads.alwintru.com/admin*` **and** `beads.alwintru.com/api/admin*`.
  - Policy `Founder only`: Action Allow, Include → Emails: `awthedev@gmail.com`. Login methods: leave One-time PIN on (Google optional).
  - Also protect previews: Workers & Pages → awt-beads → Manage → Access policy → Enable (covers `*.awt-beads.pages.dev`).

- [ ] **Step 6: [founder] Wire the JWT verification env vars**:
  - Zero Trust → Settings → Custom Pages: copy the team domain (`https://<team>.cloudflareaccess.com`).
  - The Access application's Overview tab: copy the **Application Audience (AUD) tag**.
  - Pages → Settings → Variables (Production + Preview): `ACCESS_TEAM_DOMAIN` = team domain URL, `ACCESS_AUD` = the tag.

- [ ] **Step 7: Deploy** — push `main` (founder-triggered):

```bash
git push origin main
```

Watch the Pages build succeed (it now runs the unit tests first).

- [ ] **Step 8: Verify the gate**
  - Incognito browser → `https://beads.alwintru.com/admin/` → Access login wall, and a wrong email is refused.
  - `curl -s -o /dev/null -w '%{http_code}' https://beads.alwintru.com/api/admin/overview` → `302` (redirect to login), never `200`.
  - Founder's browser (desktop **and** phone): log in, see Today/Leads/Products.

- [ ] **Step 9: Production smoke test**
  - Submit the line-sheet form on the live site with test data (company `SMOKE TEST — DELETE`).
  - Confirm: email notification arrives via Formspree; the lead is in `/admin` under New; `next_follow_up` is +2 business days.
  - Clean up:

```bash
npx wrangler d1 execute awt-business-os --remote --command "DELETE FROM activity WHERE lead_id IN (SELECT id FROM lead WHERE company_id IN (SELECT id FROM company WHERE name = 'SMOKE TEST — DELETE')); DELETE FROM lead WHERE company_id IN (SELECT id FROM company WHERE name = 'SMOKE TEST — DELETE'); DELETE FROM contact WHERE company_id IN (SELECT id FROM company WHERE name = 'SMOKE TEST — DELETE'); DELETE FROM company WHERE name = 'SMOKE TEST — DELETE'"
```

- [ ] **Step 10: Verify the site did not regress** — spot-check `/`, `/collection`, `/wholesale`, `/motifs` in a normal browser: pages render, products show, no console errors.

---

### Task 13: business-os skill, scheduled briefing, final E2E

**Files:**
- Create: `.claude/skills/business-os/SKILL.md`

- [ ] **Step 1: Write `.claude/skills/business-os/SKILL.md`**

```markdown
---
name: business-os
description: Operate the AWT Business OS D1 database — briefings, lead triage, drafts. Use for any business-operations request (leads, follow-ups, briefing, pricing data) in this repo.
---

# AWT Business OS — operator skill

The system of record is the Cloudflare D1 database `awt-business-os` (schema in
`schema/`). The public repo must never contain prices or buyer data.

## Boundaries

May do unprompted: read any data; write briefings; log activities; set
`next_follow_up`; draft replies/outreach as **Gmail drafts** (via the Gmail
MCP); research prospects; flag risks or stale data.

Ask the founder first: price changes; moving a lead's status backwards;
deleting anything; bulk edits.

Never: send external communication (email, WhatsApp, anything) — drafts only;
commit prices/buyer data to the repo; invent data. Missing information is
reported as "insufficient data", not guessed.

## Reading and writing

Query (always `--remote` for the real database; requires `npx wrangler login`):

    npx wrangler d1 execute awt-business-os --remote --json --command "SELECT ..."

Writes follow the same shape. Log every meaningful action as an activity row.
Mistake insurance: D1 Time Travel can restore the previous 30 days
(`npx wrangler d1 time-travel info awt-business-os`).

## Daily briefing recipe

1. Gather, in one session:
   - Due/overdue: `SELECT l.id, c.name, l.status, l.next_follow_up FROM lead l LEFT JOIN company c ON c.id=l.company_id WHERE l.next_follow_up <= date(datetime('now','+8 hours')) AND l.status NOT IN ('order','repeat','lost')`
   - New: `... WHERE l.status='new'`
   - Silent: `... WHERE l.status='line_sheet_sent' AND l.updated_at <= datetime('now','-7 days')`
   - Unpriced products: `SELECT COUNT(*) FROM product WHERE status='active' AND (wholesale_price_cents IS NULL OR moq IS NULL)`
2. Compose ≤6 short lines: counts with company names, then ONE highest-leverage
   action (the single thing most likely to move a lead toward an order today; if
   there are no leads, the top unblocked prep task, e.g. pricing products).
3. Write it (replace `$BODY`, keep the date expression as-is):

       npx wrangler d1 execute awt-business-os --remote --command "INSERT OR REPLACE INTO briefing (date, body) VALUES (date(datetime('now','+8 hours')), '$BODY')"

   Escape single quotes in the body by doubling them.

## Other recipes

- **Manual lead entry** (trade fair, WhatsApp inquiry): INSERT company (check
  `lower(name)` first), contact, lead (`source='manual'`), and a `note` activity.
- **Drift check**: `node scripts/drift-check.mjs` — report differences; fixing
  presentation text happens in `index.html`, commercial fields in D1.
- **Reply drafting**: read the lead's timeline first; draft into Gmail; log an
  `email_out` activity only after the founder confirms it was sent.
```

- [ ] **Step 2: Verify the skill works end-to-end** — in a Claude Code session in this repo, ask: "Following the business-os skill, write today's briefing." Confirm a `briefing` row appears (`--remote`) and renders on `/admin/#/today`.

- [ ] **Step 3: [founder] Schedule the daily briefing** — create a scheduled task (Claude's schedule feature) for **07:00 WITA daily** with the prompt:

> In ~/awt-beads, follow the business-os skill to write today's briefing into the D1 database, then stop. Do not send any external communication.

- [ ] **Step 4: Final end-to-end check (the milestone-4 gate)**
  - Morning after scheduling: briefing waiting on `/admin/#/today` (phone).
  - Work one real or test lead through `new → contacted → line_sheet_sent` with activities and follow-ups from the phone.
  - `node scripts/drift-check.mjs` → clean.
  - All tests green: `npm test && npm run test:integration`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/business-os/SKILL.md
git commit -m "Add the business-os operator skill and daily briefing recipe"
```

---

## Out of scope for SP-1 (deliberate)

Line-sheet generation (SP-2) · outreach/prospecting workspace (SP-3) · quotes,
orders, production, makers, inventory, finance (SP-4+, gated on first real
demand) · drag-and-drop kanban · manual lead creation UI (use the skill's
recipe) · email sending infrastructure of any kind.
