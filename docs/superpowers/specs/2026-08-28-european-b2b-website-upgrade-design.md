# European B2B Website Upgrade — Design Specification

**Date:** 2026-08-28
**Status:** Approved design; implementation not started

## 1. Purpose

Upgrade `beads.alwintru.com` into a high-trust wholesale website for European and international retail buyers while preserving its restrained premium editorial identity.

The site must quickly establish Borneo provenance, Kampung Manik, maker relationships, contemporary design relevance, and professional wholesale capability. It must not become a retail shop, shopping cart, generic ethical-craft site, charity narrative, or visually stereotyped ethnic presentation.

The central statement remains:

> We believe Borneo beadwork belongs in contemporary life.

The positioning hierarchy remains Borneo → place → craft → maker → contemporary design → wholesale opportunity.

## 2. Architectural Direction

Retain the current lightweight static-site and DC runtime rather than introducing a framework migration. Extract catalogue content from `index.html` into one authoritative catalogue data module that both the browser experience and `build.mjs` consume.

The build remains `node build.mjs` and publishes to `dist/`. It will generate route-specific HTML for:

- `/`, `/collection`, `/motifs`, `/wholesale`, `/our-makers`, `/contact`, and `/privacy`;
- every active category;
- every active product.

Generated pages will contain useful route-specific metadata and fallback content before JavaScript executes. Existing shared routes will remain valid; legacy category/product paths will redirect or resolve to their current canonical equivalents where needed.

The site will remain price-free and wholesale-only. No checkout, totals, inventory, payment, shipping calculator, account, or cart subsystem will be introduced.

## 3. Authoritative Catalogue and Provenance

### Catalogue model

Each product record will provide the fields needed by the collection UI, product detail, static route generation, metadata, sitemap, structured data, and enquiry shortlist. The model will include:

- stable `id` or SKU and stable route `slug`;
- `name`, `category`, `active`/`archived` state;
- primary image, gallery images, and factual alt text;
- description and short merchandising summary;
- known materials, dimensions, approximate weight, colours, hardware/closure, care, production location, and HS code;
- handmade-variation note where applicable;
- cultural provenance object.

Unknown values will be absent rather than replaced with customer-facing placeholders. Rows with absent values will not render. Missing commercially useful facts will be recorded in `docs/product-data-gaps.md` by stable product identifier and field.

### Provenance model

Each product will use one of three buyer-facing provenance classifications:

1. **Verified heritage attribution** — a specific motif/community/meaning may be shown only when supported by a recorded source or maker confirmation.
2. **Contemporary Borneo** — a new composition produced within the Kampung Manik craft ecosystem and regional beadworking practice, without asserting a traditional motif meaning.
3. **Contemporary decorative** — floral, geometric, or other decorative work with no traditional attribution.

The internal provenance object will support motif name, community, meaning, verification status, source, maker confirmation, and a conservative public note. Administrative evidence fields will not be exposed automatically.

Existing specific claims about Aso', Tinggang, Kelunan, Mata Punai, Kayan/Kenyah contexts, hornbills, ancestors, guardians, dragon-dogs, and cosmology will be treated as unverified unless the repository contains adequate evidence. Unverified records will display neutral visual descriptions.

The Motifs & Meaning page will explain that “Dayak” includes multiple communities and traditions, distinguish verified heritage designs from contemporary compositions, and state that Alana Wina Trudi does not assign meanings without confirmation.

## 4. Buyer Journey and Content

### Calls to action

Remove every live customer-facing line-sheet reference, including copy, anchors, IDs, state names, form configuration descriptions, metadata, noscript content, and comments.

Use these primary labels consistently:

- header and homepage: **Wholesale enquiry**;
- product: **Enquire about this piece**;
- wholesale page: **Send a wholesale enquiry**;
- contact area: **Wholesale enquiries**;
- secondary action: **Explore the collection**.

Wholesale pricing remains private and is provided in response to qualified enquiries, stated sparingly.

### Homepage and wholesale trust

Preserve the homepage structure, maker-focused imagery, palette, typography, and the location line “Kampung Manik · Samarinda · East Kalimantan.” Tighten copy only where necessary to answer what the work is, where it comes from, who makes it, why it differs, that it is wholesale, and how to enquire.

Add a compact “Wholesale at a glance” section containing only verified facts already supported by repository or owner evidence. Stable but currently unverified MOQ, lead time, capacity, payment, private-label, packaging, and Incoterm details will be omitted and listed in `docs/wholesale-data-needed.md`.

Keep valid official links for Instagram, LinkedIn, and InaExport and use the consistent contact address `beads@alwintru.com`. Create `docs/inaexport-brand-sync.md` with recommended profile copy and a manual cross-check checklist; no external-account automation will be attempted.

## 5. Wholesale Enquiry

### Form fields

The form will require:

- `name` — Name;
- `company` — Company / shop;
- `email` — Email;
- `country` — accessible country selector;
- `message` — “What are you looking for?”.

It will optionally accept:

- `website` — “Website / Instagram — optional”;
- `categories` — compact multi-select checkboxes for the active broad categories.

Business type, first-order size, telephone, WhatsApp, address, registration details, budget, account creation, and consent checkboxes will not be required. A lightweight visually hidden honeypot will provide proportionate spam protection.

### Session shortlist

“Enquire about this piece” will add the product’s stable identifier and name to a session-only in-memory shortlist, navigate to the enquiry form, and display the selected products near it. Buyers may add multiple unique products and remove any selection. The shortlist has no quantities, totals, price, inventory, or cart language.

Selections persist during SPA navigation and browser back/forward within the current page session. They do not use `localStorage` and therefore do not survive a full page reload. The submitted payload preserves both product IDs and names. The shortlist clears only after a confirmed successful response.

### Submission state machine

The form will have explicit states:

- **Idle:** editable form;
- **Sending:** submit disabled, visibly disabled, label “Sending…”, duplicate submissions prevented;
- **Success:** shown only after a successful HTTP response (`response.ok`), with “Thank you. Your enquiry has been sent.” and the approved Samarinda reply copy;
- **Error:** network and non-2xx responses display “We couldn't send your enquiry.” plus a direct email fallback.

Input and shortlist data remain intact after failure. Retry returns to sending without clearing the form. Error and status messages use appropriate live-region semantics, field validation is programmatically associated, and focus moves to the status summary when submission completes.

Formspree remains the processor unless its configured endpoint is deliberately replaced during implementation. The endpoint stays configurable in one place and no test submission will be sent to the live owner inbox.

## 6. Privacy, SEO, and Static Output

### Privacy

Add `/privacy`, linked from the footer and beside the enquiry form. The notice will identify Alana Wina Trudi/PT Alana Wina Trudi conservatively, provide `beads@alwintru.com`, explain form data, purposes, use, processors actually present (including Formspree while used), reasonable retention, contact-based rights requests, security limitations, and relevant external links.

It will not claim certification or use GDPR compliance as a marketing badge. Any unresolved legal-company fact will be worded conservatively and recorded as an owner action.

### Static metadata and structured data

Every generated primary, category, and product route will have a route-specific title, description, canonical, OpenGraph title/description/URL/image, and Twitter metadata in static HTML. Product pages use the product’s suitable primary image; other pages use the existing site social image unless a more relevant existing image is appropriate.

Structured data will remain truthful:

- Organization on appropriate site pages;
- CollectionPage and BreadcrumbList on categories;
- Product and BreadcrumbList on product pages.

Product data will omit fabricated price, offer, availability, rating, review, GTIN, or certification fields.

### Sitemap and fallback

`build.mjs` will generate `sitemap.xml` from the primary routes and active catalogue. Archived products, invalid routes, and duplicates are excluded. `robots.txt` continues to reference the canonical sitemap URL.

Noscript/static fallback content will be generated from the same route and catalogue data, avoid stale hardcoded counts, and provide meaningful navigation and contact information.

## 7. Accessibility, Mobile, and Performance

Changed interactions will support keyboard operation, visible focus, associated labels and errors, announced submission status, sensible focus management, modal close and Escape behavior, and touch targets of practical mobile size.

Manual checks will cover approximately 360, 390, and 430 px widths, tablet, and desktop. Header navigation, category controls, cards, product dialog, shortlist, form, status messages, and footer must not create horizontal scrolling.

The implementation will preserve lazy loading below the fold, avoid unnecessary third-party code, use intrinsic/responsive imagery where practical, and add no large application framework or CAPTCHA.

## 8. Testing and Verification

Use a small Node-based test setup suited to the static architecture. Tests will cover:

- catalogue IDs/slugs uniqueness, required active fields, and archived exclusion;
- generation and direct availability of all primary, category, privacy, and representative product routes;
- route-specific title, description, canonical, OG URL/title/image, and structured data;
- sitemap inclusion, exclusion, uniqueness, and absolute URLs;
- form validation and payload construction;
- selected product IDs/names in the enquiry payload;
- successful response handling, network failure, non-2xx failure, duplicate-submit prevention, and data preservation on error;
- browser back/forward and legacy route behavior where applicable.

Final verification will run the production build, automated tests, global legacy-copy searches, and a production-like browser smoke test. Browser testing will cover desktop and mobile homepage, collection/filtering, a representative bag product, shortlist-to-enquiry flow, safe simulated success and failure, privacy, direct category/product loading, refresh, back/forward, keyboard/focus behavior, and console errors.

## 9. Documentation and Deployment

Update README to document the actual architecture, local development, `node build.mjs`, `dist/`, Cloudflare project assumptions, catalogue location, generated files, enquiry endpoint configuration, privacy route, sitemap generation, product addition/archival, verified attribution workflow, and test commands.

The existing `.openai/hosting.json` project binding remains intact. Deployment documentation will describe only repository-confirmed settings; any Cloudflare dashboard value that cannot be inspected locally will be listed as a manual owner verification rather than guessed.

## 10. Completion Conditions

Implementation is complete only after:

- no live customer-facing line-sheet concept remains;
- the reliable wholesale-enquiry journey and session shortlist work as specified;
- privacy, static primary/category/product routes, generated sitemap, and accurate metadata exist;
- cultural claims obey the verification model;
- unknown product and wholesale facts are omitted and recorded for the owner;
- build, tests, accessibility checks, responsive smoke tests, and console checks pass;
- README and owner-action documents match the delivered architecture;
- `superpowers:verification-before-completion` and a final code/self-review have been completed with evidence.

## 11. Assumptions

- The approved session-only shortlist is intentionally not persisted through full reloads.
- Optional category interests remain as non-required multi-select controls.
- Formspree remains the enquiry processor unless implementation inspection reveals it is no longer operational or the owner supplies a replacement.
- Existing product imagery and the restrained cream/oat/sand/brown/cocoa/red design language remain the visual foundation.
- Cultural claims lacking repository evidence or maker confirmation default to neutral contemporary descriptions.
- Existing unrelated untracked files and business-workbook artifacts are outside this website upgrade and will not be modified or committed.
