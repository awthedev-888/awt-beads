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

test('payload preserves repeated form keys as arrays and keeps Formspree honeypot', () => {
  const form = new FormData();
  form.append('categories', 'Bags');
  form.append('categories', 'Earrings');
  form.append('fax', '');
  const payload = buildPayload(form, []);
  assert.deepEqual(payload.categories, ['Bags', 'Earrings']);
  assert.equal(payload.fax, '');
  assert.deepEqual(payload.selectedProducts, []);
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

test('submission posts JSON and resolves parsed response data', async () => {
  let request;
  const result = await submitEnquiry({
    endpoint: '/test',
    payload: { name: 'Buyer' },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 201, json: async () => ({ received: true }) };
    }
  });
  assert.deepEqual(result, { received: true });
  assert.equal(request.url, '/test');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Accept, 'application/json');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), { name: 'Buyer' });
});

test('network failures remain failures', async () => {
  await assert.rejects(
    submitEnquiry({ endpoint: '/test', payload: {}, fetchImpl: async () => { throw new TypeError('offline'); } }),
    /offline/
  );
});
