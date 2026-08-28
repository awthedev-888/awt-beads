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
      assert.equal(p.motifName, undefined, product.id);
      assert.equal(p.community, undefined, product.id);
      assert.equal(p.meaning, undefined, product.id);
    }
  }
});

test('non-verified products use neutral public copy', async () => {
  const { products } = await readCatalogue();
  const unsupportedCulturalTerms = /\b(?:Dayak|Kayan|Kenyah|Banjar|Bugis)\b/i;
  for (const product of products) {
    if (product.provenance.classification === 'verified-heritage') continue;
    for (const [field, value] of Object.entries({
      name: product.name,
      alt: product.alt,
      summary: product.summary,
      description: product.description,
      visualDescription: product.provenance.visualDescription
    })) {
      assert.doesNotMatch(value, unsupportedCulturalTerms, `${product.id}.${field}`);
    }
  }
});
