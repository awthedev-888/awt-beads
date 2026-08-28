/*
 * Small, dependency-free enquiry domain helpers. The UMD wrapper keeps the
 * same module usable by the Node test suite and by the browser runtime.
 */
(function attachEnquiry(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.AWTEnquiry = api;
  // A VM/browser-like host can expose `window` as a child of its global
  // object. Keep the documented browser global available in that shape too.
  if (root.window && root.window !== root) root.window.AWTEnquiry = api;
}(typeof globalThis === 'object' ? globalThis : this, function createEnquiryApi() {
  const MULTI_VALUE_FIELDS = new Set(['categories']);

  class EnquirySubmissionError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'EnquirySubmissionError';
      this.status = status;
    }
  }

  function uniqueSelections(items) {
    const seen = new Set();
    if (!Array.isArray(items)) return [];

    return items.filter(item => {
      if (!item || typeof item !== 'object' || item.id === undefined || item.id === null) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function buildPayload(formData, selectedProducts) {
    const payload = {};
    if (formData && typeof formData.entries === 'function') {
      for (const [key, value] of formData.entries()) {
        if (MULTI_VALUE_FIELDS.has(key)) {
          if (!Array.isArray(payload[key])) payload[key] = [];
          payload[key].push(value);
        } else if (Object.prototype.hasOwnProperty.call(payload, key)) {
          payload[key] = Array.isArray(payload[key]) ? [...payload[key], value] : [payload[key], value];
        } else {
          payload[key] = value;
        }
      }
    }

    payload.selectedProducts = uniqueSelections(selectedProducts);
    return payload;
  }

  async function submitEnquiry({ endpoint, payload, fetchImpl } = {}) {
    const request = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!request) throw new TypeError('A fetch implementation is required');

    const response = await request(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response || !response.ok) {
      throw new EnquirySubmissionError('Enquiry submission failed', response && response.status);
    }

    return response.json();
  }

  return { uniqueSelections, buildPayload, submitEnquiry, EnquirySubmissionError };
}));
