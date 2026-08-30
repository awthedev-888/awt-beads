# Website verification — 2026-08-28

Verified locally on 2026-08-31 against a fresh generated `dist/` build. This record distinguishes repository evidence from actions that require the owner’s external-account access.

## Automated build and route evidence

Commands run after the browser-found fixes:

```sh
node --test test/*.test.mjs
node build.mjs
git diff --check
```

Results:

- `node --test test/*.test.mjs`: **57 passed, 0 failed, 0 skipped**.
- `node build.mjs`: **71 routes built**.
- `git diff --check`: exit 0; no whitespace errors.

The suite includes five clean-route server tests: decoded traversal rejection, local delayed success, local non-2xx response, local connection-reset simulation, and a production-semantics route matrix. It also starts the installed Wrangler Pages development server against a temporary build and checks canonical HTML, a static asset, a legacy 301, an unknown-path 404, and the absence of Wrangler's infinite-loop warning.

## Clean-route verification server

`test/serve-dist.mjs` was run at `http://127.0.0.1:4173` while browser checks were performed. It serves flat generated routes as clean URLs, applies generated `_redirects`, rejects decoded traversal, provides fixed content types, and returns the generated noindex `404.html` with status 404 for unknown paths.

Observed HTTP checks:

| Request | Result |
| --- | --- |
| `/` | 200 `text/html; charset=utf-8` |
| `/collection/bags/amira-tote` | 200 `text/html; charset=utf-8` |
| `/enquiry.js` | 200 `text/javascript; charset=utf-8` |
| `/collection/table-textiles` | 301 to `/collection/table-runners` |
| `/no-such-route` | 404 with generated noindex page |

The browser form tests used temporary local builds whose configurable endpoint was set to one of `/__verify/enquiry-success`, `/__verify/enquiry-http-error`, or `/__verify/enquiry-network-error`. No request was sent to the live Formspree endpoint; the final standard `node build.mjs` restored the production endpoint configuration in ignored `dist/`.

## Browser matrix

| Viewport | Checks run | Result |
| --- | --- | --- |
| 1280 × 900 | Homepage action, collection, Bags filter, direct Bags/Amira routes, refresh, back/forward, product dialog, shortlist, validation, local success/non-2xx/network simulations, privacy, console | No horizontal overflow or significant console errors. All listed journey states behaved as recorded below. |
| 360 × 800 | Menu open/close, Bags → Amira → enquiry, shortlist/form controls, labels/live regions, target measurements | No horizontal overflow; menu was 52 × 44 px; close, product enquiry, remove, and submit controls were at least 44 px high. |
| 390 × 800 | Menu open, Bags → Amira → enquiry, product/form target measurements | No horizontal overflow; menu opened with `aria-expanded="true"`; product controls 44 px and enquiry controls at least 44 px high. |
| 430 × 800 | Menu open, Bags → Amira → enquiry, product/form target measurements | No horizontal overflow; menu opened with `aria-expanded="true"`; product controls 44 px and enquiry controls at least 44 px high. |
| 768 × 800 | Menu open, Bags → Amira → enquiry, product/form target measurements, keyboard focus | No horizontal overflow; menu opened with `aria-expanded="true"`; focus-visible outline measured as `#8E2321` solid 2 px. |

### Desktop journey details

- Direct `/collection/bags/amira-tote` load rendered the dialog and focused `#product-dialog-close`. The product-card metadata was visible.
- Shift+Tab from the dialog close button focused the product enquiry action; Tab from that action returned to close, confirming keyboard containment.
- Opening Amira from the Bags collection and pressing Escape closed the dialog, restored `/collection/bags`, and returned focus to the `View Amira Tote details` opener.
- The Bags filter showed `9 of 56 pieces`, retained Amira, and excluded the earring product checked in the same interaction.
- A homepage → collection → Amira journey went back to `/collection` without a dialog and forward to the Amira dialog with close-button focus. Reloading the direct Amira route reopened the dialog with the same focus target.
- `/privacy` loaded directly and visibly contained both Formspree processing information and `beads@alwintru.com`.

### Enquiry states

- Empty required submission displayed the associated required-field errors; browser-native blocking was disabled so the designed error state can render.
- The local 200 endpoint produced the disabled `Sending…` state, then focused the polite success summary, cleared the form, and cleared the shortlist. The disabled state is the browser evidence for duplicate-submit prevention; the state-machine test independently asserts only one pending request is submitted.
- The local 503 endpoint focused the assertive error summary, retained the shortlist and all checked non-sensitive field values, and retained a valid email field (the browser control intentionally does not expose the email value in inspection output).
- The local connection-reset endpoint produced `Failed to fetch` in the assertive error summary, preserved the shortlist and the checked field values, and re-enabled the submit control.

### Accessibility and visual observations

- All six enquiry labels were associated with their controls and their respective error descriptions. The shortlist remove button announced `Remove Amira Tote from enquiry`.
- The sending region is polite; the rendered success and error summaries are polite and assertive respectively, and both received focus at completion.
- Measured contrast ratios: primary submit 7.74:1, shortlist remove 8.35:1, and product enquiry action 7.02:1. These all exceed normal-text AA contrast.
- At the checked widths, the clean menu operation, 44 px targets, no-overflow result, focus outline, dialog Escape/focus return, labels, status regions, and disabled sending state remained intact.

### Final-review regression checks

- Wrangler accepted the generated redirect file without the former catch-all infinite-loop warning. Canonical HTML and assets returned 200, the legacy collection URL returned 301, and an unknown path returned the generated 404 page with status 404.
- The raw `x-dc` template is statically hidden. The generated route fallback is visible without JavaScript or when the runtime fails, and is hidden only after a successful runtime mount.
- Generated pages embed active products only and an allow-listed buyer-safe provenance projection. The archived `cuff` ID and provenance evidence keys such as source citations and maker-confirmation flags are absent.
- Homepage video posters are self-hosted. Browser inspection found zero YouTube iframes before activation; the play action created one `youtube-nocookie.com` iframe.
- The wholesale country control is a labelled, required native select with a placeholder plus 249 ISO alpha-2 options. Browser selection normalized Germany to `DE`; the form uses Formspree's standard `_gotcha` field and no `fax` field.
- The Amira product dialog contains one primary image branch. Product/category social images do not inherit the homepage's 1200 × 630 dimension declarations.
- Kanaya's alternative text now describes woven natural rattan, and broad homepage copy is qualified so it does not claim that every collection piece begins with beads and cotton.

## Browser-found fixes and root causes

| Defect | Root cause | Fix and guard |
| --- | --- | --- |
| Homepage table-runner card could advertise the old category path | Static canonical routes use `table-runners`, while two homepage anchors retained `table-textiles`. | Both anchors now use `/collection/table-runners`; route-output assertions reject the stale path. |
| Product-card metadata was blank for catalogue-backed records | The product-card template reads `p.meta`, but the authoritative-catalogue runtime mapping supplied only `matsShort`. | Map `meta` from `summary`; runtime guard checks every product has it. |
| Browser-native required-field UI obscured the designed validation summary and labels did not match the approved buyer-field wording | The form lacked `noValidate` and retained pre-spec label/copy text. | Add `noValidate`, approved labels, and approved success/error copy; route-output assertions cover them. |
| Shortlist remove control had no explicit horizontal target minimum | Its icon-only button relied on content size. | Add `.enquiry-remove-button { min-width:44px }`; browser measured 44 × 44 px and an assertion guards the class/label. |
| Contemporary product dialog repeated the same description | Catalogue `provenance.visualDescription` intentionally matched the factual `description`, while the dialog always rendered both. | Preserve the contemporary classification label but render provenance detail only when it differs; TDD RED failed with Amira’s duplicate text, then the focused suite passed and a final browser check counted the description once. |

## Final legacy and cultural-claim audit

Commands run against current source and fresh `dist/`:

```sh
rg -n -i "line[ -]?sheet|linesheet|Request the current|pricing in the line sheet|in the line sheet|confirmed in the line sheet" index.html build.mjs build-lib.mjs site-routes.mjs enquiry.js catalogue.json README.md robots.txt _redirects dist
rg -n -i "dragon-dog|guardian|ancestor|messenger bird|old cosmology|upper world|lower world" index.html catalogue.json dist
```

- The line-sheet audit had **zero matches**.
- The cultural-claim audit had no matches in `index.html` or `catalogue.json`. Its five `ancestor` hits were implementation identifiers/comments inside generated third-party runtime assets (`dist/support.js` and `dist/image-slot.js`), not buyer-facing website or catalogue claims. No cultural meaning was added or exposed by those hits.

## Self-review

- Reviewed the final diff against the approved design and Task 9 acceptance criteria.
- Confirmed the authoritative catalogue’s `summary` now consistently feeds the runtime product-card `meta` field; generated metadata/fallback uses the catalogue directly.
- Confirmed archived exclusion, canonical category/product agreement, and direct clean-route availability through tests, build output, browser navigation, and the local server.
- Confirmed Formspree was never used in the verification journey; local endpoints exercised only the specified safe outcomes.
- Confirmed error preservation, status focus, dialog focus restoration, and no staged unrelated artifacts. The UI fixes are in `e476ad6`; server/evidence are committed separately.

## Owner actions still required

1. In Cloudflare Pages, verify the intended repository and production branch, build command `node build.mjs`, output directory `dist`, and serving of generated `dist/server/index.js`/assets. After deployment, check the homepage, a direct category/product route, privacy, robots, and sitemap.
2. In Google Search Console, submit or resubmit `https://beads.alwintru.com/sitemap.xml` after the deployment and monitor indexing/coverage; this repository cannot confirm the dashboard state.
3. Complete the manual InaExport comparison in `docs/inaexport-brand-sync.md`; do not publish MOQ, capacity, export markets, Incoterms, or cultural meanings without owner-supported evidence.
4. Supply the missing product facts tracked by stable ID in `docs/product-data-gaps.md` and the commercial facts in `docs/wholesale-data-needed.md` before any public copy or quote template is expanded.

## Limits

This is a local production-like verification, not a live Cloudflare, Formspree, Search Console, or InaExport verification. Full-page assets were loaded locally; third-party dashboard configuration and live delivery remain owner checks.
