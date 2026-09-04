import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readCatalogue } from './helpers.mjs';

const expectedSkus = new Map([
  ['table-runner-emerald-mirror', 'AWT-TR-001'],
  ['table-runner-twin-tiger', 'AWT-TR-002'],
  ['table-runner-four-bird', 'AWT-TR-003'],
  ['table-runner-diamond-scroll', 'AWT-TR-004'],
  ['table-runner-crimson-mirror', 'AWT-TR-005'],
  ['coaster-turquoise-fringe', 'AWT-CO-001'],
  ['coaster-white-star', 'AWT-CO-002'],
  ['coaster-red-fringe', 'AWT-CO-003'],
  ['coaster-yellow-fringe', 'AWT-CO-004'],
  ['hanging', 'AWT-HD-001'],
  ['hanging-central-vessel', 'AWT-HD-002'],
  ['hanging-twin-tiger', 'AWT-HD-003'],
  ['hanging-red-branch', 'AWT-HD-004'],
  ['necklace-ketupat-emas', 'AWT-NE-001'],
  ['necklace-ketupat-putih', 'AWT-NE-002'],
  ['necklace-ketupat-kuning', 'AWT-NE-003'],
  ['necklace-ketupat-mawar', 'AWT-NE-004'],
  ['necklace-ketupat-monokrom', 'AWT-NE-005'],
  ['necklace-bunga-merah', 'AWT-NE-006'],
  ['necklace-bunga-biru', 'AWT-NE-007'],
  ['necklace-bunga-putih', 'AWT-NE-008'],
  ['necklace-bunga-merah-pelangi', 'AWT-NE-009'],
  ['necklace-bunga-putih-pelangi', 'AWT-NE-010'],
  ['earrings-golden-sun-hoop', 'AWT-EA-001'],
  ['earrings-blush-gold-hoop', 'AWT-EA-002'],
  ['earrings-ruby-white-hoop', 'AWT-EA-003'],
  ['earrings-scarlet-sun-hoop', 'AWT-EA-004'],
  ['earrings-sky-blossom-hoop', 'AWT-EA-005'],
  ['earrings-ember-bloom-hoop', 'AWT-EA-006'],
  ['earrings-ruby-white-flower', 'AWT-EA-007'],
  ['earrings-golden-black-flower', 'AWT-EA-008'],
  ['earrings-green-white-flower', 'AWT-EA-009'],
  ['earrings-scarlet-gold-flower', 'AWT-EA-010'],
  ['earrings-pink-white-flower', 'AWT-EA-011'],
  ['earrings-golden-loop-fringe', 'AWT-EA-012'],
  ['earrings-scarlet-loop-fringe', 'AWT-EA-013'],
  ['earrings-midnight-gold-loop-fringe', 'AWT-EA-014'],
  ['earrings-ivory-scarlet-loop-fringe', 'AWT-EA-015'],
  ['earrings-ivory-sun-loop-fringe', 'AWT-EA-016'],
  ['bracelet-set-tricolour-braided', 'AWT-BR-001'],
  ['bracelet-set-floral-panel', 'AWT-BR-002'],
  ['bracelet-set-lattice-button', 'AWT-BR-003'],
  ['bracelet-set-pastel-cord', 'AWT-BR-004'],
  ['keychain-set-floral-loop', 'AWT-KC-001'],
  ['keychain-set-geometric-loop', 'AWT-KC-002'],
  ['keychain-set-triangular-tassel', 'AWT-KC-003'],
  ['keychain-set-beaded-strand', 'AWT-KC-004'],
  ['amira', 'AWT-BG-001'],
  ['zania', 'AWT-BG-002'],
  ['lisha', 'AWT-BG-003'],
  ['ratna', 'AWT-BG-004'],
  ['gitta', 'AWT-BG-005'],
  ['defni', 'AWT-BG-006'],
  ['viona', 'AWT-BG-007'],
  ['halda', 'AWT-BG-008'],
  ['kanaya', 'AWT-BG-009'],
]);

test('all 56 active products use the catalogue SKU mapping', async () => {
  const catalogue = await readCatalogue();
  const products = catalogue.products.filter((product) => product.status === 'active');

  assert.equal(products.length, 56);
  assert.equal(expectedSkus.size, 56);
  assert.deepEqual(
    new Map(products.map(({ id, sku }) => [id, sku])),
    expectedSkus,
  );

  const skus = products.map(({ sku }) => sku);
  assert.equal(new Set(skus).size, 56, 'every active SKU must be unique');
  for (const sku of skus) {
    assert.match(sku, /^AWT-(TR|CO|HD|NE|EA|BR|KC|BG)-\d{3}$/);
  }
});

test('the product detail specification list renders the SKU', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('<div class="product-modal-copy"');
  const detail = html.slice(start, html.indexOf('</dl>', start));

  assert.match(detail, />SKU<\/dt>/);
  assert.match(detail, /\{\{ product\.sku \}\}/);
  assert.equal((html.match(/\{\{ product\.sku \}\}/g) ?? []).length, 1);
});
