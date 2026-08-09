# Motifs & Meaning — content redesign

**Date:** 2026-08-09
**Page:** `/motifs` (the Motifs & Meaning screen inside `index.html`, currently lines ~321–391)
**Status:** approved design, awaiting implementation plan

## Goal

Rebuild the Motifs & Meaning page around the philosophy that underlies Dayak beadwork —
cosmology, colour, figure and form — instead of the current flat list of four motif
families. The page becomes the cultural backbone of the site: the place a European
wholesale buyer learns *why* the work looks the way it does, in copy they can borrow
for shelf cards.

## Decisions already made (user-approved)

1. **Full restructure**, not additive patching. The page is reorganised from a
   philosophical frame downward; the existing four motif sections survive but are
   re-homed inside it.
2. **Honest layering of claims.** Strongly sourced meanings are stated plainly.
   Pan-Borneo material is framed as such ("known across Kalimantan as…").
   Thinly sourced meanings are not invented — mata punai stays "grammar", with no
   fabricated symbolism.
3. **No product linkage.** The page speaks of beadwork vocabulary in general terms.
   It does not reference the earring line, the bags, or any SKU.
4. Page language stays **English**; the "Motifs & Meaning" eyebrow and the `/motifs`
   route are unchanged.

## Page structure

Seven blocks, in order. H1 changes from "Four families of motif" to
**"How to read the beadwork"**.

### §0 Intro (rewrite of existing)

Reframes the page: the beadwork carries a cosmology in colour, figure and form, and
this page reads it the way the village does. Retains the existing line inviting
buyers to borrow the copy for shelf cards and product pages. 2–3 sentences.

### §1 Two worlds, held in balance (new)

The interpretive frame for everything below:

- Upper world: the hornbill's realm, sky, messengers of the gods.
- Lower, watery world: the realm of the aso' and the serpent — feminine,
  protective, fertile.
- The tree of life joins them — *batang garing* to the Ngaju, *kayo urip* to the
  Kayan — roots in the underworld, crown in the sky, the human world on its trunk.
- Payoff sentence: Dayak art keeps the two worlds in balance, which is why beadwork
  compositions pair and mirror.

Three short paragraphs. No photography; the existing bead-band divider separates it
from the intro. Framing note: tree-of-life terminology is attributed to the groups
that use it (Ngaju, Kayan) per the honesty rule.

### §2 The figures (re-homed existing four families)

A short section intro (1–2 sentences) placing the families inside the §1 frame,
then the four existing sub-sections in the current order, with these edits:

- **Aso'** — add: creature of the watery lower world, feminine in nature; guardian
  and fertility figure. Existing copy about hooks/spirals and protected objects stays.
- **Tinggang** — make the upper-world messenger role explicit (currently implied).
  Existing copy about the casque/tail lines stays.
- **Kelunan** — keep the rank framing and deepen it with the documented ladder:
  full figure for the highest rank (*deta'u*), head-only for lesser aristocrats
  (*deta'u dumit*), abstract curves for commoners; note that in the old belief,
  wearing above one's rank invited illness. Keep "the figures beaded in Kampung
  Manik today are new drawings in that tradition."
- **Mata punai & the borders** — stays essentially as-is: the grammar that frames
  larger motifs, where beaders improvise. Explicitly no symbolic meaning is added.

All four existing `image-slot` placeholders and captions are kept untouched.

### §3 Colour as prayer (new)

Opens with the strongest insight: the colour clash is deliberate — the meeting of
strong colours is read as the harmony of a life in balance with nature and the
Creator; a prayer worn in contrast.

Then a **six-swatch grid rendered in CSS** (no photography dependency). Each swatch:
colour chip, Indonesian name, English name, one-line meaning:

| Colour | Meaning |
|---|---|
| Merah / red | the spirit of life |
| Kuning / yellow | majesty and the sacred |
| Hijau / green | the essence of the natural world |
| Putih / white | purity of faith in the Creator |
| Hitam / black | wards off harm |
| Biru / blue | strength that does not fade |

Swatch chips depict beads, not UI, so they use vivid bead-true values rather than
the site's muted palette: red `#C8322B`, yellow `#F2B705`, green `#1E7A3C`,
white `#F5F1E6` (with a hairline border so it reads on the cream page), black
`#1C1714`, blue `#2456A6`. Closing line, scholarly
sourced: in classic Kenyah work black, yellow and white dominate the field while
red, green and blue arrive as accents.

### §4 Form, movement, sound (new)

Three short passages on general beadwork vocabulary (no product references):

- **The triangle** — pucuk rebung, the bamboo shoot: growth and new life. Framed
  honestly as a form "known across Kalimantan and the wider archipelago".
- **Mirror symmetry** — compositions pair left and right; the balance of the two
  worlds carried into the geometry.
- **Fringe and dangles** — protection working two ways, from the Kenyah baby-carrier
  tradition: beauty attracts and settles the soul; movement and sound repel what
  should stay away.

Text only. Optional small inline glyphs are out of scope.

### §5 The beads themselves (new, short)

Two paragraphs: beads came to Borneo across oceans of trade and became *pusaka* —
heirlooms passed down generations; the most prized old beads (the Kayan *lukut
sekala*) carried extraordinary exchange value. Grounds the material's dignity
without romancing it.

### §6 A note on cultural respect (existing, one addition)

Existing block stays. Add one sentence in the spirit of the honesty rule: meanings
vary between Dayak groups and between sources; what is written here is the reading
common in East Kalimantan.

## Technical notes

- All changes live inside the `isMotifs` block of `index.html`; the screen's outer
  scaffolding (eyebrow, divider, container widths, `data-reveal` behaviour) is reused.
- **`ROUTES()` desc for `motifs` must be updated** — it currently reads "The four
  families of Dayak motif behind the beadwork…" and `build.mjs` bakes it into static
  meta tags. New desc should reflect the cosmology/colour/form scope.
- The colour grid is plain styled `div`s in the page's existing inline-style idiom
  (Archivo/Young Serif/Karla, existing spacing patterns). No new JS, no new assets,
  no new image slots.
- No catalog, navigation, or other-screen changes.

## Sources for the copy

- Colour meanings and clash-as-harmony: Indonesia Kaya; RRI; Liputan6; Kompas.
- Cosmological dualism, aso'/hornbill roles: Art of the Ancestors (Borneo);
  Encyclopedia.com (Ngaju); BEADS Journal, "Evoking the Aso'" (Campbell Cole).
- Tree of life: Fabulahub (Batang Garing); ResearchGate (kayo urip / batang garing).
- Rank ladder and soul/charm mechanics of the ba': Penn Museum Expedition,
  "Baby Carriers"; ResearchGate, "Ba': The Shifting Role of Baby Carrier…".
- Pucuk rebung: Indonesia Travel (Kaltim); general pan-archipelago sources.
- Heirloom beads / lukut sekala: BEADS Journal, "Heirloom Beads among the Dayak of
  Borneo" (Campbell Cole).

## Explicitly out of scope

- Any reference to products, SKUs, the earring line, or the catalog.
- Invented meanings for mata punai or any motif where sourcing is thin.
- New photography or image slots; changes to existing slot placeholders.
- Translation of the page to Indonesian.
- Changes to any other screen.

## Acceptance criteria

1. Page renders at `/motifs` with the seven blocks above, in order, in the site's
   existing visual idiom; existing image slots intact.
2. H1 reads "How to read the beadwork"; `ROUTES()` desc updated; `node build.mjs`
   passes and the built `motifs.html` carries the new title/desc meta.
3. Colour grid renders without images and remains legible at mobile widths.
4. No occurrence of product or SKU names anywhere in the new copy.
5. Claims follow the honesty layering: pan-Borneo framing present for pucuk rebung;
   no symbolic claim attached to mata punai; cultural-respect addition present.
