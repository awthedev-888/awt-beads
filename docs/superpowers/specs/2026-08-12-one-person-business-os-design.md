# AWT One-Person Business OS — SP-1 "Lead Desk" design

**Date:** 2026-08-12
**Scope:** first sub-project of the Business OS (foundation + lead desk); roadmap for the rest
**Status:** approved design, awaiting implementation plan
**Background:** `docs/business-research.md`

## Goal

Give the founder one owned system where every wholesale inquiry lands, nothing is
dropped, and each morning answers "what do I need to know and do today?" — at
$0/month, without touching the working public site, using Claude Code as the AI
layer instead of rented infrastructure.

## Decisions already made (user-approved)

1. **Reality check:** the business is pre-launch with no records to migrate. The OS
   starts empty and is sized accordingly.
2. **Run cost:** ~free. Cloudflare free tiers for infrastructure; AI work happens
   through the founder's existing Claude subscription (Claude Code sessions and
   scheduled tasks), not metered server-side API calls.
3. **Architecture:** Option A — Cloudflare-native mini-app in this repo (D1 +
   Pages Functions + Access-gated `/admin`), Claude Code as operator. Rejected:
   repo-only/local-first (outgrown too fast, no capture endpoint), off-the-shelf
   SaaS glue (fragmented ownership, weak Claude fit).
4. **Decomposition:** the master prompt's ~10 subsystems become sequenced
   sub-projects, each with its own spec → plan → build cycle:
   SP-1 Lead Desk (this spec) → SP-2 Line-sheet engine → SP-3 Outreach desk →
   SP-4 Quote/Order/Production (gated on first real demand) → later finance, KPIs,
   content. Nothing is built before the thing it manages exists.
5. **Data model:** six tables, 8-stage pipeline (below). The master prompt's
   34-entity model is a growth path, not a starting point.
6. **AI boundary:** Claude drafts, researches, logs, briefs; the founder sends,
   prices, and decides. Encoded in a repo-committed `business-os` skill.

## System architecture

One repo, one Cloudflare Pages project, two faces:

```
awt-beads/
├── index.html          # public site — untouched by SP-1
├── build.mjs           # extended only to run node --test and copy admin/ into dist/
├── admin/              # OS dashboard: self-contained HTML+JS, house visual style,
│                       #   no framework, talks to /api/admin/*
├── functions/
│   └── api/
│       ├── lead.js     # POST /api/lead — the only public endpoint
│       └── admin/      # JSON API for the dashboard (Access-gated)
├── schema/             # numbered D1 migrations: 0001-init.sql, 0002-seed-products.sql…
└── docs/               # this spec, research, plans
```

- **Database:** Cloudflare D1 (SQLite), free tier. System of record for all
  commercial and buyer data. **The repo is public: prices, buyer identities and
  conversation data live only in D1, never in git.** (The public site already
  follows this instinct — no prices on any page.)
- **Auth:** Cloudflare Access (free ≤50 users) in front of `/admin` and
  `/api/admin/*`; policy = founder's Google account. Verified from an incognito
  session as an explicit milestone check.
- **Public endpoint hardening:** `POST /api/lead` gets honeypot field, per-IP rate
  limit, strict server-side validation, parameterized inserts.
- **Claude's access:** local `wrangler` with a D1-scoped API token in the
  founder's shell env (never committed). The `business-os` skill wraps allowed
  operations. Safety net: D1 time-travel restore (30 days) + every mutation
  writes an `activity` row (audit trail).

### Lead capture is dual-write, failing toward safety

`/api/lead` writes to D1 **and** forwards the submission to the existing Formspree
endpoint, so today's email notification keeps arriving unchanged. If `/api/lead`
returns non-2xx or is unreachable, the browser falls back to posting Formspree
directly. A lead is never lost; Formspree demotes from system-of-record to backup
channel. (Formspree free cap: 50/mo — ample; Resend documented as the swap when
volume demands.)

### Product data: one master for commerce, one for presentation

D1 `product` is master for commercial fields (prices, MOQ, HS codes, lead times,
status), seeded from the site's 30-product array plus `line-sheet-earrings.xlsx`.
`index.html` remains master for public presentation (names, stories, images). A
drift-check (script or Claude session) warns when shared fields diverge. SP-1
therefore carries zero regression risk to the live site.

## Data model (SP-1)

| Table | Purpose | Fields beyond the obvious |
|---|---|---|
| `product` | commercial master, 30 SKUs | sku, name, category, motif, materials, dims, weight, colours, hs_code, moq, lead_time, wholesale_price, rrp, currency, status, notes, timestamps |
| `company` | buyer organization | name, country, type, website, instagram, notes |
| `contact` | person at a company | company_id, name, email, phone_whatsapp, role |
| `lead` | one sales conversation | company_id, contact_id, source, status, product_interest, next_follow_up, timestamps |
| `activity` | timeline + audit log | lead_id, company_id (both nullable FKs; at least one required), type (form_submission, email_out, email_in, whatsapp, note, status_change, briefing_note), body, meta JSON, created_at |
| `briefing` | daily briefing | date (unique), body markdown |

**Pipeline (8 + lost):** `new → contacted → replied → line_sheet_sent → sample →
quote → order → repeat`, plus `lost`. Statuses are a CHECK constraint, not a table.

**Growth path (documented, not built):** `quote`/`quote_item` on first real quote
request · `order`/`order_item`, `production_order` on first confirmed order ·
`maker` when production tracking starts · `inventory_movement` when stock exists.

## Core workflows

1. **Inbound lead:** form → `/api/lead` → validate → upsert company + contact
   (contact matched by email; company by case-insensitive name, else created) →
   create lead (status `new`, `next_follow_up` = +2 business days, Mon–Fri in
   WITA, matching the site's reply promise) → `form_submission` activity →
   forward to Formspree → surfaces in Today view until triaged.
2. **Follow-up loop:** Today view lists follow-ups due/overdue and silent-after-
   line-sheet leads. Founder or a Claude session drafts replies into Gmail drafts,
   logs the activity, sets the next follow-up. Founder sends. Nothing relies on
   memory.
3. **Morning briefing:** scheduled Claude task (daily 07:00 WITA, founder-
   adjustable) reads D1 → writes ≤6 lines to `briefing` (new leads, due
   follow-ups, silent buyers, one highest-leverage action) → waiting on the
   Today view, phone included. No email infrastructure.

## Dashboard IA (three screens, house style)

- **Today** (default): briefing + exceptions only (overdue follow-ups, untriaged
  leads, silent buyers) + one highest-leverage action. Empty state says "nothing
  needs you."
- **Leads:** pipeline board + filterable list; detail = activity timeline,
  follow-up setter, status mover.
- **Products:** 30 SKUs, commercial fields editable, completeness indicators
  (13 SKUs lack prices at seed time), drift-check status.

Desktop-first, responsive to phone. Visual language borrowed from the site
(Young Serif / Archivo, the site's palette) so the OS feels like AWT, not a SaaS
admin.

## AI / human boundary (the `business-os` skill)

- **Claude may, unprompted:** read all data; write briefings; log activities; set
  follow-up dates; draft replies and outreach into Gmail drafts; research
  prospects; flag risks and stale data.
- **Claude asks first:** price changes, backwards pipeline moves, deletions, bulk
  edits.
- **Claude never:** sends external communication; commits prices or buyer data to
  the repo; invents data — missing information is reported as "insufficient data."

## Error handling

- Capture: dual-write with browser fallback (above); endpoint failures logged.
- API: explicit 4xx on validation failure, JSON error bodies; no silent catches.
- Briefing task: a failed run leaves yesterday's briefing visible with its date —
  stale-but-honest beats missing.
- All D1 mutations parameterized; no string-built SQL anywhere.

## Testing

- `node --test` unit tests for pure logic: form validation, business-day
  follow-up math, seed integrity, (later) line-sheet totals. Run inside the Pages
  build command — a red test blocks deploy.
- Integration test of `POST /api/lead` against `wrangler dev` (happy path,
  validation failure, honeypot hit, Formspree-down path).
- Per-milestone manual E2E on desktop + phone, per the verification-before-
  completion discipline.

## Milestones (each independently verifiable)

1. **Schema + seed.** Migrations apply cleanly to a fresh D1; queries return 30
   products; earring prices match `line-sheet-earrings.xlsx` exactly.
2. **Capture.** A real form submission lands in D1 *and* the founder's inbox; the
   public site is otherwise byte-identical; fallback verified by disabling the
   endpoint.
3. **Admin core.** Founder logs in through Access (desktop + phone; incognito is
   refused); works a test lead `new → line_sheet_sent` with activities and
   follow-ups.
4. **Today + briefing.** An overdue lead surfaces on Today; the scheduled Claude
   task writes the morning briefing; the `business-os` skill lives in the repo.

SP-2 (line-sheet engine) and SP-3 (outreach desk) follow as separate spec → plan
cycles.

## Risks

| Risk | Mitigation |
|---|---|
| Commercial data leaks into public repo | Hard rule: D1 only; checked in every review |
| Access misconfigured, admin exposed | Explicit incognito test in milestone 3 |
| Formspree 50/mo cap | Ample pre-launch; Resend swap documented |
| Claude token blast radius | D1-scoped token, time-travel restore, activity audit |
| Overbuilding | Sub-projects gated on real-world triggers; §42 of the master prompt |
| Solo-founder bus factor | Everything documented in docs/; system degrades to "email still works" |
