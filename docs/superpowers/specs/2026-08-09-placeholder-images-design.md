# Placeholder images — design

**Date:** 2026-08-09
**Status:** approved design, awaiting implementation plan
**Scope decision (user-approved):** fill 15 still-life placeholders with Canva-generated
images. People and place slots (`hero-hands`, `home-hands`, `about-portrait`,
`about-group`, `about-village`, `about-river`) are **excluded** — they wait for real
photography. Nothing that depicts a face, hands, or the village may be generated.

## Goal

Replace the empty `image-slot` placeholders on the live site with generated images
that read as natural product/detail photography — researched first so the four motif
macros depict what the motifs actually look like up close.

## The fifteen images

Aspect: every image is generated at 1080×1350 (4:5, the proven Canva pipeline).
Slots with other ratios (1:1, 3:2) render via `object-fit: cover`, so the CSS crop
absorbs the ratio difference. Compose with ~12% top/bottom safe margin so the 1:1
and 3:2 crops lose nothing important.

### A. Motif macros (Motifs page, 1:1 display)

Extreme close-ups of beadwork, "close enough to count the beads". No dish, no
styling — the beadwork fills the frame edge to edge. Art direction comes from the
research step; working notes:

| File | Slot | Subject |
|---|---|---|
| `images/motifs/aso.jpg` | `motif-aso` | Curling hook-and-spiral scrollwork (aso') in vivid red/white on a jet-black bead field |
| `images/motifs/tinggang.jpg` | `motif-tinggang` | Long curved hornbill casque-and-tail lines sweeping across the field |
| `images/motifs/kelunan.jpg` | `motif-kelunan` | A standing figure, arms raised, faceted into the bead grid, ochre/black/white |
| `images/motifs/borders.jpg` | `motif-borders` | Rows of mata punai diamonds with zigzag and paired-hook companion rows |

### B. Category shots (home page, 4:5 display)

Styled still-lifes matching the site's staging idiom (pale ceramic, linen, rattan,
warm directional daylight). Subjects follow the placeholder text already written
into the site:

| File | Slot | Subject (from the site's own placeholder brief) |
|---|---|---|
| `images/categories/decor.jpg` | `cat-decor` | Beaded wall panel on a plaster wall above a rattan bench |
| `images/categories/jewelry.jpg` | `cat-jewelry` | Necklace and cuff on natural stone, hard light |
| `images/categories/keychains.jpg` | `cat-keychains` | Beaded keychains in a rattan counter tray, shallow depth |
| `images/categories/table.jpg` | `cat-table` | Beaded runner set on rustic wood with linen and stoneware |

`cat-decor`'s original brief says "Tinggang wall panel"; the image depicts a beaded
panel with curved bird-like lines but the catalog copy stays unchanged.

### C. Product cards (Collection page, 4:5 bleed display)

One photo per catalog product that currently has no `src`. Colourways follow the
catalog's first listed variant. Staging follows each product's existing `img`
brief in the catalog:

| File | Product id | Colourway to depict |
|---|---|---|
| `images/products/placemats.jpg` | `placemats` | Oat / cocoa mats, ceramic plate and brass cutlery, top-down |
| `images/products/coasters.jpg` | `coasters` | Assorted border-pattern coasters fanned on stone, glass of tea |
| `images/products/hanging.jpg` | `hanging` | Cream / cocoa figure column, beside a linen curtain |
| `images/products/necklace.jpg` | `necklace` | Cocoa / cream / red strands on natural stone, macro |
| `images/products/cuff.jpg` | `cuff` | Black / multi cuff **worn on a wrist** resting on a rattan chair arm, per the original brief (user-approved exception to the no-people rule) |
| `images/products/keychains.jpg` | `keychains` | Assorted border tags in a rattan counter tray |

The cuff keeps its original brief ("on a wrist resting on a rattan chair arm") —
the user explicitly approved this single exception to the no-people rule. The
framing stays tight: forearm and wrist only, no face, no second person. Its
catalog `img` string is unchanged. Modal detail slots (`d1`/`d2`) stay as
placeholders.

### D. About page

| File | Slot | Subject |
|---|---|---|
| `images/about/beads.jpg` | `about-beads` | Glass seed beads in wooden sorting trays, top-down, no hands |

## Visual rules (bind every image)

- Beadwork: vivid opaque glass seed beads — black/yellow/white dominant fields with
  red/green/blue accents; visible individual beads; bead fringe where the form has
  one; NO bone, tusk, shell, or carved charms; NO text, logos, or watermarks.
- Staging: the site's muted world — cream ceramic, undyed linen, rattan, plaster,
  stone; soft directional daylight, one clean shadow.
- NO people: no faces, no hands, no bodies, no reflections of people. **Single
  exception, user-approved: the cuff image shows a wrist/forearm wearing the cuff**
  — framed tight (no face, no second person), and held to an extra skin-realism
  gate: correct anatomy, natural skin texture with pores and fine lines, no waxy
  or airbrushed AI skin, believable contact shadow where the cuff meets the wrist.

## Naturalness gate (user-directed: "senatural mungkin, tidak terlalu terlihat AI")

Prompt-side, every prompt includes:
- hand-made irregularity — slightly uneven bead rows, minor thread visible, the two
  earrings/pieces of a pair not perfectly identical
- real-camera vocabulary — 50mm/85mm macro, f/4, natural window light, slight
  film grain; no HDR, no dreamy glow
- imperfect staging — a crumb of texture in the linen, natural fabric creases

Review-side, reject a candidate that shows any AI tell:
- impossible bead physics (rows melting into each other, fringe strands merging,
  beads without holes/thread logic)
- plastic or CGI sheen, over-smooth gradients, oversaturated HDR look
- perfect mirror symmetry down to individual beads
- garbled geometry in the motif (a figure with wrong limbs, unreadable scrollwork)
- any text, brand, or watermark; any misplaced object; any person or body part
- staging that floats (missing shadows, wrong reflections)

Each image is reviewed at full resolution before acceptance, not only as a
thumbnail. Failed images are re-prompted individually; text layers are deleted via
the Canva edit API when a candidate is otherwise good.

## Research step (before prompts are written)

Targeted image-oriented research on how these motifs look in close-up on real
Kenyah/Kayan beadwork (museum ba' panels, baby-carrier aban): the visual grammar
of aso' hooks/spirals at macro distance, hornbill renderings in beads, kelunan
figure proportions, mata punai border rows. Findings become 3–5 line art-direction
notes per motif macro, recorded in the implementation plan's prompts. Reference
photos inform prompt language only — they are never uploaded or copied.

## Technical wiring

- New directories: `images/motifs/`, `images/categories/`, `images/products/`,
  `images/about/` (build.mjs copies `images` recursively — no build change).
- Static slots: each filled `image-slot` element in `index.html` is replaced by an
  `<img src="…" alt="…" loading="lazy" style="position:absolute;inset:0;width:100%;
  height:100%;object-fit:cover">` inside the existing aspect-ratio box; the
  "Shot · …" caption paragraphs under the motif macros stay.
- Product cards: the six catalog entries gain `src` + `bleed: true` (existing
  mechanism); their `img` briefs stay as alt-text source except the cuff's, which
  is restaged. Alt text follows the existing pattern.
- Canva designs that ship are kept at top level; rejected candidates are moved to
  the existing archive folder for manual deletion.
- Deploy: commit per logical group, push once at the end, verify live checksums.

## Out of scope

- The six excluded people/place slots and the `image-slot` runtime itself
  (still needed for them).
- Product modal detail slots (`d1`/`d2`).
- Any catalog spec fields (dims/weight/HS stay as they are).
- OG image, logo, or any other asset.

## Acceptance criteria

1. The 15 images exist in the repo, 1080×1350 JPEG, and render in their slots on
   home, collection, motifs and about screens; the six excluded slots still show
   placeholders.
2. Every shipped image passes the naturalness gate checklist above at full
   resolution; zero text/watermarks; zero people.
3. Motif macros are recognisable as their motif per the research notes (aso'
   curvilinear, not chevrons; kelunan a readable figure; borders diamond rows).
4. The six product cards render bleed (edge-to-edge) like the earrings; bags
   unchanged; `node build.mjs` passes; live page verified after push.
5. The cuff image shows the cuff worn on a wrist per its brief, passes the
   skin-realism gate, and contains no face; every other image contains no person.
