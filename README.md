# AWT Beads — Alana Wina Trudi

Wholesale website for Alana Wina Trudi: hand-beaded Borneo craft from Kampung Manik, Samarinda, East Kalimantan, Indonesia.

Live site: <https://beads.alwintru.com/>

## Architecture

This is a statically built site. The browser experience uses the existing lightweight DC runtime; Node.js generates route-specific HTML before deployment.

- `index.html` is the source template, screen content, styles, and runtime component. Its catalogue and route markers are intentionally empty in source, so do not serve it as the production site.
- `catalogue.json` at the repository root is the authoritative category and product data source.
- `site-routes.mjs` defines the primary routes and derives category/product routes from the catalogue.
- `build-lib.mjs` contains the build implementation; `build.mjs` runs it for `https://beads.alwintru.com`, writes to `dist/`, and prints the generated route manifest.
- `enquiry.js` provides the browser enquiry helpers and `support.js`/`image-slot.js` provide the runtime support and image handling.

## Prerequisites and local workflow

Use a current Node.js LTS release with native ESM and `node:test` support. `npm`/`npx` is only needed below for the optional static server.

Run the production build from the repository root:

```sh
node build.mjs
```

Then serve the generated `dist/` directory with a static server that resolves clean URLs to their generated `.html` files. For example:

```sh
npx --yes serve dist
```

Open the URL printed by the server and check `/`, `/collection`, a category or product route, `/privacy`, and `/sitemap.xml`. Serving the source `index.html` directly, or using a server that rewrites every path to the source file, bypasses the generated catalogue and route metadata.

Run the complete automated test suite with:

```sh
node --test test/*.test.mjs
```

The normal pre-deployment check is:

```sh
node --test test/*.test.mjs && node build.mjs
```

`dist/` is generated output and is ignored by Git. It can be removed and rebuilt at any time.

## What the build generates

`node build.mjs` reads `index.html` and `catalogue.json`, then creates `dist/` from scratch. It generates:

- `index.html` plus static primary pages for `/collection`, `/motifs`, `/wholesale`, `/our-makers`, `/contact`, and `/privacy`;
- category pages under `/collection/{category-slug}`;
- product pages under `/collection/{category-slug}/{product-slug}` for active products only;
- route-specific title, description, canonical, Open Graph/Twitter metadata, structured data, and meaningful `<noscript>` fallback content;
- `sitemap.xml` containing the absolute URL of every generated indexable route, with archived products excluded;
- `_redirects`, including the maintained legacy table-textiles/jewelry redirects and the site fallback rule;
- `robots.txt`, copied from the repository, which references the canonical sitemap;
- `server/index.js`, a generated asset-fetch handler, plus the runtime scripts, images, logos, and other static assets needed by the pages.

The catalogue is embedded into each generated page in the `awt-catalogue` JSON marker; the build does not copy a standalone `catalogue.json` into `dist/`. The generated route records are embedded in the `awt-route-data` marker.

## Maintaining `catalogue.json`

The top-level shape is `{ "categories": [], "products": [] }`.

Each category has `id`, `name`, `slug`, `image`, `alt`, and `description`. Each product has stable `id`, `name`, `slug`, `categoryId`, `status`, `image`, `alt`, `summary`, `description`, `productionLocation`, `gallery`, and `provenance` fields. Buyer-facing optional fields include `materials`, `dimensions`, `weight`, `colours`, `hardware`, `care`, `hsCode`, and `variationNote`.

To add a product:

1. Put its image under `images/` and set `image` to a site-root-relative URL such as `/images/product.webp`; this keeps image URLs correct on nested generated routes.
2. Add a unique product object to `catalogue.json` with a category ID that exists in `categories`, a canonical slug, `status: "active"`, complete required copy, and a provenance classification.
3. Keep claims and specifications to facts that have a source or maker confirmation. Leave unknown commercial or product values absent rather than inventing them.
4. Run `node --test test/*.test.mjs && node build.mjs`, then inspect the generated category/product page and sitemap entry.

To archive a product, retain its record and change only its status to `"archived"` after checking the intended ID. Archived products are omitted from the runtime product list, generated product routes, and sitemap. Rebuild so the generated redirects and pages reflect the current active catalogue.

### Provenance and attribution

The supported buyer-facing classifications are `verified-heritage`, `contemporary-borneo`, and `contemporary-decorative`. A visual pattern alone is not evidence of a named tradition, community, or meaning.

Use `verified-heritage` only when the record includes a repository source citation (`provenance.source`) or explicit maker confirmation (`provenance.makerConfirmed: true`). Record `motifName`, `community`, and `meaning` only when that attribution is supported. For contemporary work, use the neutral classification and a factual `visualDescription`; do not infer cultural meaning. Keep the evidence with the product record so a future editor can re-check it before changing public copy.

## Wholesale enquiries and privacy

The wholesale form is rendered from `index.html`. Its `formEndpoint` data prop is the single endpoint configuration point; the current production value is a Formspree endpoint. `enquiry.js` builds a JSON payload containing the buyer fields, repeated category selections, the Formspree honeypot field, and selected product IDs/names, then posts it to that endpoint. If the endpoint changes, update the data prop and rebuild `dist/`.

Do not send automated or manual test submissions to the live Formspree endpoint. The enquiry tests provide safe local fetch implementations and verify success, non-2xx, and network-failure handling without contacting the owner inbox.

The `/privacy` route is generated like the other primary routes. It documents the form fields, response/business-record purpose, Formspree processing while configured, reasonable retention, contact-based rights requests, security limitations, and external services. The enquiry form and footer link to this route.

## Cloudflare Pages deployment

`.openai/hosting.json` contains the repository’s Cloudflare project binding (`project_id`). It does not expose or claim the current Cloudflare dashboard configuration.

The owner must verify these values in the Cloudflare Pages project before relying on a deployment:

- the intended repository and production branch are connected;
- the build command is exactly `node build.mjs`;
- the build output directory is exactly `dist`;
- the deployment serves the generated `dist/server/index.js`/asset setup as intended by the project’s current Pages configuration.

Those dashboard values cannot be inspected from this repository, so this README does not claim that they are already configured. After a Pages deployment, check the homepage, a direct category and product URL, `/privacy`, `/robots.txt`, and `/sitemap.xml`, and confirm that the deployed pages contain generated catalogue data.
