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
  const COUNTRY_CODES = Object.freeze(`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' '));
  const regionNames = typeof Intl === 'object' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en-GB'], { type: 'region' })
    : null;
  const COUNTRIES = Object.freeze(COUNTRY_CODES.map(code => Object.freeze({
    code,
    name: regionNames ? regionNames.of(code) : code
  })));

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

  return { COUNTRIES, uniqueSelections, buildPayload, submitEnquiry, EnquirySubmissionError };
}));
