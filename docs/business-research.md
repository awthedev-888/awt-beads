# AWT business research — discovery for the One-Person Business OS

**Date:** 2026-08-12
**Sources:** this repository (site, product data, line-sheet workbook, docs), the live
site at beads.alwintru.com, the Bekal Bisnis reference page (business mechanics only),
and founder answers given during the brainstorming session of 2026-08-12.
**Status:** discovery record behind `docs/superpowers/specs/2026-08-12-one-person-business-os-design.md`

## Business model

PT Alana Wina Trudi (AWT) sells hand-beaded Dayak craft — bags, jewelry, home décor,
table textiles, keychains — made by the women of Kampung Manik, Samarinda, East
Kalimantan. **Wholesale only, no consumer sales.** Target buyers are European
retailers (concept stores, lifestyle retailers). Registered Indonesian exporter
(INSW; InaExport profile 80801). Selling is inquiry-based: there is no checkout and
no prices on the site; pricing lives in a line sheet released on request.

**Operational stage: pre-launch.** As of 2026-08-12 essentially no wholesale
inquiries or orders have happened. There are no existing business records to
migrate. This single fact sizes everything in the OS design: the system's first job
is to *start* commerce flowing (capture leads, enable outreach, remove friction from
the funnel), not to administer volume that does not yet exist.

## Customer segments

- European concept stores and lifestyle retailers (primary; the site's copy, EUR
  pricing and Incoterms are built for them).
- Fair-trade / artisan-goods retailers and small chains.
- Marketplace wholesale channels (Faire, Ankorstore) — mentioned in the README as
  TBD, not yet live.

## Buyer journey (as designed by the current site)

1. Discover site (Instagram, LinkedIn, InaExport, search).
2. Browse Collection / Motifs & Meaning (cultural story is the differentiator).
3. Request the line sheet (form on /wholesale → currently Formspree → email inbox).
4. Receive line sheet ≤2 business days (manual email; promise is stated on the site).
5. Order samples — courier from Samarinda, cost credited against first order.
6. Pro forma invoice → 50% deposit → production → balance before dispatch.
7. Ship: courier for small orders, sea LCL out of Balikpapan (EXW Samarinda / FOB
   Balikpapan).
8. Repeat orders (aspiration; none yet).

## Lead generation model

Today: passive inbound only (site + socials). Pre-launch reality means inbound will
trickle at best; **outbound prospecting is the actual growth engine** and is entirely
manual/nonexistent today. This is the strongest argument for the Outreach Desk
sub-project (SP-3).

## Sales, production, fulfilment processes (current state)

All of it lives in email + WhatsApp + the founder's head. Products exist as a
JavaScript array inside `index.html` (30 SKUs). `line-sheet-earrings.xlsx` gives
the 17 earrings SKU codes and descriptions, but its price/MOQ/HS columns are an
unfilled template — **no product in the business has a price yet**; pricing is
open founder work. There is no CRM, no order record,
no production tracking, no finance record. Production is by the makers of Kampung
Manik with per-product lead times of roughly 3–7 weeks where stated.

## Cash-flow cycle

50/50 payment terms give a naturally founder-friendly cycle: deposit funds
materials and production; balance clears before goods leave. The OS needs to *track*
this (deposits due, balances outstanding), not finance it. Nothing to track yet.

## Recurring operational work (once flowing)

Answer inquiries ≤2 business days · send line sheets · follow up silent buyers ·
quote · invoice pro forma · chase deposits/balances · brief makers · QC · pack ·
book courier/LCL · export docs · post content · update socials.

## Founder bottlenecks (predicted, pre-launch)

1. **Prospecting** — finding and researching European retailers is slow, skilled work.
2. **Follow-up discipline** — solo founders drop threads; the site promises 2-day replies.
3. **Line-sheet upkeep** — 13 of 30 SKUs have no price; manual workbook editing.
4. **Context memory** — buyer preferences and history scattered across email/WhatsApp.

## Automation opportunities (ranked by leverage-per-effort)

1. Lead capture into an owned database with automatic follow-up dates (SP-1).
2. Daily briefing: exceptions + one highest-leverage action (SP-1, scheduled Claude task).
3. AI-drafted, founder-sent outreach and replies via Gmail drafts (SP-1/SP-3).
4. Line sheet generated from product data instead of hand-maintained (SP-2).
5. Quote/order/production tracking (SP-4 — only when real orders exist).

**Deliberately not automated:** sending any external communication, pricing
decisions, cultural claims, quality judgment, relationships.

## What the Bekal Bisnis reference actually teaches

The page is a tiered digital-product funnel for an agate-necklace business. Its
transferable mechanics, stripped of branding: WhatsApp scripts and follow-up
templates as first-class sales assets; HPP (COGS) worksheets; simple order forms;
"supplier/stok/keuangan/repeat" as a flat toolkit; SOP + QC checklists. Lesson:
small, template-driven, WhatsApp-centric operations — evidence for right-sizing,
against enterprise tooling.

## Risks

- Public repo: commercial data (prices, buyers) must never enter git — D1 only.
- Free-tier ceilings: Formspree 50 submissions/mo (fine at this volume; Resend swap
  documented as the escape hatch).
- Solo founder: the system must degrade gracefully to "email still works."
- Overbuilding: the master prompt describes ~10 subsystems; each is gated on the
  reality it manages actually existing.

## Recommended KPIs (only ones with data behind them at each stage)

Pre-launch: line-sheet requests/week · outreach sent/week · reply rate ·
follow-ups overdue (target 0). Post-first-order: quote→order conversion · average
order value · on-time production rate · outstanding balances.

## Recommended AI operating model

Not ten agents — **one Claude Code installation with a `business-os` skill**, plus
scheduled tasks, operating the shared D1 database and the founder's Gmail (drafts
only). Specializations (sales research, briefing, content) are skill sections, not
infrastructure. Founder approves everything outbound.

## Recommended data model

Six tables now (product, company, contact, lead, activity, briefing); growth path to
quote/order/production_order/maker/inventory_movement documented in the spec and
built only on real triggers. Full detail in the design spec.
