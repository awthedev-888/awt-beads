# Motifs & Meaning Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/motifs` page in `index.html` around Dayak cosmology — two worlds, figures, colour, form, and the beads themselves — per the approved spec.

**Architecture:** All changes live inside the `isMotifs` block of `index.html` (single-file static prototype rendered by the DC runtime) plus one line in the `ROUTES()` table that `build.mjs` bakes into static meta tags. New sections copy the page's existing inline-style idiom verbatim; the colour grid is pure CSS `div`s with zero new assets.

**Tech Stack:** Hand-written HTML with inline styles inside `index.html`; `node build.mjs` prerender; preview server `awt-beads` (port 8899) for browser verification.

**Spec:** `docs/superpowers/specs/2026-08-09-motifs-meaning-content-design.md`

## Global Constraints

- Page language is English; eyebrow "Motifs & Meaning" and route `/motifs` unchanged.
- H1 becomes exactly: `How to read the beadwork`.
- Honest layering: pucuk rebung framed as "known across Kalimantan and the wider archipelago"; **no symbolic meaning attached to mata punai**; tree-of-life names attributed to Ngaju and Kayan.
- **No product, SKU, or catalog references** anywhere in the new copy.
- Keep all four existing `image-slot` elements and their captions byte-identical.
- Swatch chip hexes, verbatim: red `#C8322B`, yellow `#F2B705`, green `#1E7A3C`, white `#F5F1E6` (+ inset hairline), black `#1C1714`, blue `#2456A6`.
- `ROUTES()` desc strings must contain no double quotes (build.mjs parses them with a strict regex).
- Every commit message ends with the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.
- Do not push until the final task; the repo auto-deploys to Cloudflare Pages on push to `main`.

---

### Task 1: Header, intro, and §1 "Two worlds, held in balance"

**Files:**
- Modify: `index.html` — the Motifs header block (currently ~lines 324–331)

**Interfaces:**
- Consumes: existing page idiom (Archivo eyebrow, Young Serif headings, `data-reveal`, bead-band divider).
- Produces: a `<section>` with `border-bottom:1px solid #DACBAE` immediately after the divider; Task 2 inserts its section-intro right after it.

- [ ] **Step 1: Update H1 and intro paragraph**

Edit `index.html`. Replace this exact old string:

```html
    <h1 class="cmb" style="font-family:'Young Serif',serif;font-weight:400;font-size:clamp(34px,4.4vw,52px);line-height:1.06;margin:14px 0 0;max-width:20ch;text-wrap:balance">Four families of motif</h1>
    <p class="cmb" style="font-size:16.5px;line-height:1.65;color:#4A3B2A;max-width:62ch;margin:16px 0 0">Every piece in the collection carries one of a small family of Dayak motifs. Knowing them is good floor talk, and this page is written to be borrowed for your shelf cards and product pages.</p>
```

with:

```html
    <h1 class="cmb" style="font-family:'Young Serif',serif;font-weight:400;font-size:clamp(34px,4.4vw,52px);line-height:1.06;margin:14px 0 0;max-width:20ch;text-wrap:balance">How to read the beadwork</h1>
    <p class="cmb" style="font-size:16.5px;line-height:1.65;color:#4A3B2A;max-width:62ch;margin:16px 0 0">Dayak beadwork carries an old cosmology in colour, figure and form. This page reads it the way the village does &mdash; and it is written to be borrowed, freely, for your shelf cards and product pages.</p>
```

- [ ] **Step 2: Insert §1 after the divider**

In `index.html`, find this exact anchor (the divider plus the opening of the content container):

```html
  <div style="height:42px;background:#2A211A url('/bead-band.svg') center/auto 42px repeat-x" aria-hidden="true"></div>

  <div style="max-width:1240px;margin:0 auto;padding:0 clamp(24px,3.5vw,44px)">
```

and insert immediately after it:

```html

    <section style="padding:clamp(48px,6vw,88px) 0;border-bottom:1px solid #DACBAE" data-reveal="">
      <p style="margin:0;font-family:Archivo,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#6D5B45">The frame</p>
      <h2 style="font-family:'Young Serif',serif;font-weight:400;font-size:clamp(30px,3.6vw,44px);line-height:1.05;margin:12px 0 0">Two worlds, held in balance</h2>
      <p style="font-size:16px;line-height:1.7;color:#4A3B2A;max-width:62ch;margin:18px 0 0">Dayak art begins with a divided universe. The upper world belongs to the sky and its great messenger, the hornbill; the lower world is water, home of the serpent and the aso&rsquo;. Neither is evil and neither rules alone &mdash; the point of the universe, and of the art, is the balance between them.</p>
      <p style="font-size:16px;line-height:1.7;color:#4A3B2A;max-width:62ch;margin:14px 0 0">Joining the two stands a tree. The Ngaju call it <em>batang garing</em>, the Kayan <em>kayo urip</em> &mdash; the tree of life, roots in the underworld, crown in the sky, the human world resting on its trunk. People live mid-tree, between powers, and the work of a good life is keeping the two ends in conversation.</p>
      <p style="font-size:16px;line-height:1.7;color:#4A3B2A;max-width:62ch;margin:14px 0 0">Hold that picture and the beadwork starts to explain itself. Compositions pair and mirror; a bird answers a serpent; borders run in matched halves. The symmetry is not decoration. It is the balance of the worlds, restated in glass.</p>
    </section>
```

- [ ] **Step 3: Build and verify**

Run: `node build.mjs`
Expected: `built 6 routes, copied 11/11 assets into dist/`

Run: `grep -c "How to read the beadwork" index.html` → `1`; `grep -c "Two worlds, held in balance" index.html` → `1`; `grep -c "Four families of motif" index.html` → `0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Reframe the Motifs page around the two-world cosmology

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: §2 "The figures" — section intro and the three paragraph edits

**Files:**
- Modify: `index.html` — the four motif family sections (currently ~lines 333–383)

**Interfaces:**
- Consumes: §1 section from Task 1 (the new intro paragraph sits between §1's `</section>` and the Aso' `<section>`).
- Produces: the four family sections unchanged in structure; Task 3 inserts the colour section after the mata punai section's closing `</section>`.

- [ ] **Step 1: Insert the section intro for the figures**

Find the exact line (closing of §1 followed by the Aso' section opener):

```html
    </section>

    <section style="display:flex;flex-wrap:wrap;gap:clamp(28px,4.5vw,64px);align-items:center;padding:clamp(48px,6vw,88px) 0;border-bottom:1px solid #DACBAE" data-reveal="">
      <div style="flex:1 1 340px;min-width:min(100%,300px);max-width:520px">
        <div style="aspect-ratio:1/1;position:relative;background:#EFE6D3;box-shadow:inset 0 0 0 1px rgba(52,41,29,.09)"><image-slot id="motif-aso"
```

Replace the blank line between `</section>` and `<section ...>` with a short intro block, so the region becomes:

```html
    </section>

    <div style="padding:clamp(40px,5vw,64px) 0 0" data-reveal="">
      <p style="margin:0;font-family:Archivo,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8E2321">The figures</p>
      <p style="font-size:16.5px;line-height:1.65;color:#4A3B2A;max-width:62ch;margin:12px 0 0">Four families of figure populate that universe, and every piece of beadwork carries at least one of them.</p>
    </div>

    <section style="display:flex;flex-wrap:wrap;gap:clamp(28px,4.5vw,64px);align-items:center;padding:clamp(48px,6vw,88px) 0;border-bottom:1px solid #DACBAE" data-reveal="">
      <div style="flex:1 1 340px;min-width:min(100%,300px);max-width:520px">
        <div style="aspect-ratio:1/1;position:relative;background:#EFE6D3;box-shadow:inset 0 0 0 1px rgba(52,41,29,.09)"><image-slot id="motif-aso"
```

(Only the intro `<div>` is new; the `<section>` and everything after it is byte-identical to what was there.)

- [ ] **Step 2: Deepen the Aso' paragraph**

Replace this exact old string:

```html
Part dog, part serpent, the aso&rsquo; is the great guardian figure of Kayan and Kenyah art. On beadwork its body unwinds
```

with:

```html
Part dog, part serpent, the aso&rsquo; is the great guardian figure of Kayan and Kenyah art &mdash; a creature of the watery lower world, feminine in nature, guarding fertility and the family. On beadwork its body unwinds
```

- [ ] **Step 3: Make Tinggang's upper-world role explicit**

Replace this exact old string:

```html
In Dayak cosmology the rhinoceros hornbill flies between the upper world and this one as a messenger and an omen bird, and today it is the emblem of Kalimantan itself.
```

with:

```html
In Dayak cosmology the rhinoceros hornbill is the bird of the upper world, flying down into this one as a messenger of the gods and an omen bird &mdash; and today it is the emblem of Kalimantan itself.
```

- [ ] **Step 4: Deepen the Kelunan rank ladder**

Replace this exact old string:

```html
A standing figure, arms raised, faceted into the bead grid. In older work the figure marked rank, with the fullest versions reserved for the carriers of leading families, and it stood as ancestor and guardian over the child who rode beneath it. The figures beaded in Kampung Manik today are new drawings in that tradition.
```

with:

```html
A standing figure, arms raised, faceted into the bead grid. In older work the figure was a privilege graded by rank: the full figure for the highest families (the <em>deta&rsquo;u</em>), the head alone for lesser aristocrats, abstract curves for everyone else &mdash; and wearing above one&rsquo;s station was believed to invite illness. On a baby carrier the figure stood as ancestor and guardian over the child who rode beneath it. The figures beaded in Kampung Manik today are new drawings in that tradition, made for anyone.
```

The mata punai section is not edited in any way.

- [ ] **Step 5: Build, verify, commit**

Run: `node build.mjs` → passes.
Run: `grep -c "deta&rsquo;u" index.html` → `1`; `grep -c "bird of the upper world" index.html` → `1`; `grep -c "watery lower world" index.html` → ≥`1`.
Verify the four image slots are untouched: `grep -c 'id="motif-' index.html` → `4`.

```bash
git add index.html
git commit -m "Re-home the four figure families beneath the cosmology frame

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: §3 "Colour as prayer" — the swatch grid

**Files:**
- Modify: `index.html` — insert after the mata punai section's closing `</section>`

**Interfaces:**
- Consumes: the mata punai section (last of the four family sections; the only one whose `<section>` has no `border-bottom`).
- Produces: a colour section ending in `</section>`; Task 4 inserts the forms section immediately after it.

- [ ] **Step 1: Add a bottom border to the mata punai section**

The mata punai section is currently the last content section, so it has no `border-bottom`. It is no longer last. Replace:

```html
    <section style="display:flex;flex-wrap:wrap-reverse;gap:clamp(28px,4.5vw,64px);align-items:center;padding:clamp(48px,6vw,88px) 0" data-reveal="">
      <div style="flex:1 1 400px;min-width:0">
        <p style="margin:0;font-family:Archivo,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#6D5B45">Motif family 04</p>
```

with:

```html
    <section style="display:flex;flex-wrap:wrap-reverse;gap:clamp(28px,4.5vw,64px);align-items:center;padding:clamp(48px,6vw,88px) 0;border-bottom:1px solid #DACBAE" data-reveal="">
      <div style="flex:1 1 400px;min-width:0">
        <p style="margin:0;font-family:Archivo,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#6D5B45">Motif family 04</p>
```

- [ ] **Step 2: Insert the colour section**

Find the anchor — the end of the mata punai section followed by the cultural-respect box:

```html
        <p class="cm" style="font-family:Archivo,sans-serif;font-size:12.5px;color:#6D5B45;margin:12px 0 0">Shot &middot; 1:1 &middot; Border patterns in rows, the grammar of the work.</p>
      </div>
    </section>

    <section style="border:1px solid #B79B7C;padding:clamp(24px,3.5vw,44px);margin:0 0 clamp(64px,8vw,110px);max-width:860px" data-reveal="">
```

Insert between `</section>` and the respect box:

```html

    <section style="padding:clamp(48px,6vw,88px) 0;border-bottom:1px solid #DACBAE" data-reveal="">
      <p style="margin:0;font-family:Archivo,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#6D5B45">The palette</p>
      <h2 style="font-family:'Young Serif',serif;font-weight:400;font-size:clamp(30px,3.6vw,44px);line-height:1.05;margin:12px 0 0">Colour as prayer</h2>
      <p style="font-size:16px;line-height:1.7;color:#4A3B2A;max-width:62ch;margin:18px 0 0">The first thing anyone notices about Dayak beadwork is that the colours collide. That collision is the point. Strong colour set against strong colour is read as harmony &mdash; a life in balance with nature and the Creator &mdash; and a beader choosing her palette is composing something close to a prayer.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:clamp(14px,2vw,24px);margin-top:clamp(26px,3.5vw,40px)">
        <div>
          <div style="height:64px;background:#C8322B"></div>
          <p style="font-family:'Young Serif',serif;font-size:17px;margin:10px 0 0">Merah</p>
          <p style="font-family:Archivo,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6D5B45;margin:2px 0 0">Red</p>
          <p style="font-size:14.5px;line-height:1.55;color:#4A3B2A;margin:6px 0 0">The spirit of life.</p>
        </div>
        <div>
          <div style="height:64px;background:#F2B705"></div>
          <p style="font-family:'Young Serif',serif;font-size:17px;margin:10px 0 0">Kuning</p>
          <p style="font-family:Archivo,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6D5B45;margin:2px 0 0">Yellow</p>
          <p style="font-size:14.5px;line-height:1.55;color:#4A3B2A;margin:6px 0 0">Majesty and the sacred.</p>
        </div>
        <div>
          <div style="height:64px;background:#1E7A3C"></div>
          <p style="font-family:'Young Serif',serif;font-size:17px;margin:10px 0 0">Hijau</p>
          <p style="font-family:Archivo,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6D5B45;margin:2px 0 0">Green</p>
          <p style="font-size:14.5px;line-height:1.55;color:#4A3B2A;margin:6px 0 0">The essence of the natural world.</p>
        </div>
        <div>
          <div style="height:64px;background:#F5F1E6;box-shadow:inset 0 0 0 1px rgba(52,41,29,.18)"></div>
          <p style="font-family:'Young Serif',serif;font-size:17px;margin:10px 0 0">Putih</p>
          <p style="font-family:Archivo,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6D5B45;margin:2px 0 0">White</p>
          <p style="font-size:14.5px;line-height:1.55;color:#4A3B2A;margin:6px 0 0">Purity of faith in the Creator.</p>
        </div>
        <div>
          <div style="height:64px;background:#1C1714"></div>
          <p style="font-family:'Young Serif',serif;font-size:17px;margin:10px 0 0">Hitam</p>
          <p style="font-family:Archivo,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6D5B45;margin:2px 0 0">Black</p>
          <p style="font-size:14.5px;line-height:1.55;color:#4A3B2A;margin:6px 0 0">Wards off harm.</p>
        </div>
        <div>
          <div style="height:64px;background:#2456A6"></div>
          <p style="font-family:'Young Serif',serif;font-size:17px;margin:10px 0 0">Biru</p>
          <p style="font-family:Archivo,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6D5B45;margin:2px 0 0">Blue</p>
          <p style="font-size:14.5px;line-height:1.55;color:#4A3B2A;margin:6px 0 0">Strength that does not fade.</p>
        </div>
      </div>
      <p style="font-size:15px;line-height:1.65;color:#6D5B45;max-width:62ch;margin:clamp(22px,3vw,32px) 0 0;font-style:italic;font-family:Karla,sans-serif">In classic Kenyah work the field itself is usually black, yellow and white; red, green and blue arrive as accents. Look at any beaded panel with that key and the composition begins to sort itself.</p>
    </section>
```

- [ ] **Step 3: Build, verify, commit**

Run: `node build.mjs` → passes.
Run: `grep -c "Colour as prayer" index.html` → `1`; `grep -o "#C8322B\|#F2B705\|#1E7A3C\|#F5F1E6\|#1C1714\|#2456A6" index.html | sort -u | wc -l` → `6`.

```bash
git add index.html
git commit -m "Add the colour-as-prayer swatch grid to the Motifs page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: §4 "Form, movement, sound", §5 "The beads themselves", §6 respect addition

**Files:**
- Modify: `index.html` — insert after the colour section; edit the respect box

**Interfaces:**
- Consumes: colour section from Task 3 (its closing `</section>` directly precedes the respect box).
- Produces: the final page structure; Task 5 verifies it end to end.

- [ ] **Step 1: Insert §4 and §5 between the colour section and the respect box**

Find the anchor (end of the colour section against the respect box):

```html
      <p style="font-size:15px;line-height:1.65;color:#6D5B45;max-width:62ch;margin:clamp(22px,3vw,32px) 0 0;font-style:italic;font-family:Karla,sans-serif">In classic Kenyah work the field itself is usually black, yellow and white; red, green and blue arrive as accents. Look at any beaded panel with that key and the composition begins to sort itself.</p>
    </section>

    <section style="border:1px solid #B79B7C;padding:clamp(24px,3.5vw,44px);margin:0 0 clamp(64px,8vw,110px);max-width:860px" data-reveal="">
```

Insert between `</section>` and the respect box:

```html

    <section style="padding:clamp(48px,6vw,88px) 0;border-bottom:1px solid #DACBAE" data-reveal="">
      <p style="margin:0;font-family:Archivo,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#6D5B45">The shapes</p>
      <h2 style="font-family:'Young Serif',serif;font-weight:400;font-size:clamp(30px,3.6vw,44px);line-height:1.05;margin:12px 0 0">Form, movement, sound</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(20px,3vw,36px);margin-top:clamp(24px,3vw,36px)">
        <div style="border-top:2px solid #34291D;padding-top:16px">
          <h3 style="font-family:'Young Serif',serif;font-weight:400;font-size:19px;margin:0">The triangle</h3>
          <p style="font-size:15px;line-height:1.65;color:#4A3B2A;margin:10px 0 0">A triangle read upward is <em>pucuk rebung</em>, the bamboo shoot &mdash; a form known across Kalimantan and the wider archipelago as a sign of growth, new life and hope. Bamboo does not grow back where it was cut; it sends up a new shoot beside the old. The triangle carries that promise.</p>
        </div>
        <div style="border-top:2px solid #34291D;padding-top:16px">
          <h3 style="font-family:'Young Serif',serif;font-weight:400;font-size:19px;margin:0">Mirror symmetry</h3>
          <p style="font-size:15px;line-height:1.65;color:#4A3B2A;margin:10px 0 0">Compositions pair left and right, and the pairing is cosmology as much as aesthetics: upper world and lower world, each acknowledged, neither dominant. When a panel mirrors itself down the centre line, it is keeping the universe&rsquo;s accounts in order.</p>
        </div>
        <div style="border-top:2px solid #34291D;padding-top:16px">
          <h3 style="font-family:'Young Serif',serif;font-weight:400;font-size:19px;margin:0">Fringe and dangles</h3>
          <p style="font-size:15px;line-height:1.65;color:#4A3B2A;margin:10px 0 0">On the old Kenyah baby carriers, ornament worked twice over. Beauty was functional: a bright beaded panel attracted the child&rsquo;s wandering soul and persuaded it to stay. The hanging strands did the opposite work &mdash; moving, clacking, catching light &mdash; to startle away whatever should not come near. Fringe is protection you can hear.</p>
        </div>
      </div>
    </section>

    <section style="padding:clamp(48px,6vw,88px) 0" data-reveal="">
      <p style="margin:0;font-family:Archivo,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#6D5B45">The material</p>
      <h2 style="font-family:'Young Serif',serif;font-weight:400;font-size:clamp(30px,3.6vw,44px);line-height:1.05;margin:12px 0 0">The beads themselves</h2>
      <p style="font-size:16px;line-height:1.7;color:#4A3B2A;max-width:62ch;margin:18px 0 0">None of this is made from local material, and that is part of the meaning. Glass beads reached Borneo along the old trade routes &mdash; from India, Venice, China &mdash; and the interior adopted them so completely that they became <em>pusaka</em>: heirlooms, handed down, named, remembered.</p>
      <p style="font-size:16px;line-height:1.7;color:#4A3B2A;max-width:62ch;margin:14px 0 0">The most prized old beads carried astonishing value; a single <em>lukut sekala</em>, the Kayan&rsquo;s most treasured bead, could be exchanged for goods worth a small fortune. The beads sewn in Kampung Manik today are new glass &mdash; but they are strung into that long history, one row at a time.</p>
    </section>
```

- [ ] **Step 2: Add the honesty sentence to the respect box**

Replace this exact old string:

```html
We do not sell ceremonial objects or antiques, and nothing on this site should be read as one.</p>
```

with:

```html
We do not sell ceremonial objects or antiques, and nothing on this site should be read as one. Meanings also vary &mdash; between Dayak peoples, between villages, between sources; what is written here is the reading most common in East Kalimantan, told plainly.</p>
```

- [ ] **Step 3: Build, verify, commit**

Run: `node build.mjs` → passes.
Run: `grep -c "Form, movement, sound" index.html` → `1`; `grep -c "The beads themselves" index.html` → `1`; `grep -c "lukut sekala" index.html` → `1`; `grep -c "reading most common in East Kalimantan" index.html` → `1`.

```bash
git add index.html
git commit -m "Add form, material and honesty passages to the Motifs page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: ROUTES desc, full-page verification, push

**Files:**
- Modify: `index.html` — the `motifs` entry in the `ROUTES()` table (~line 1135)

**Interfaces:**
- Consumes: everything above; `build.mjs` parses the ROUTES entry with regex `desc: "([^"]*)"` — the new desc must contain no double quotes.
- Produces: the deployed page.

- [ ] **Step 1: Update the route desc**

Replace this exact old string:

```js
      motifs:     { path: "/motifs", title: "Motifs & Meaning | Alana Wina Trudi", desc: "The four families of Dayak motif behind the beadwork: aso' the dragon-dog, tinggang the hornbill, kelunan the human figure, and the border patterns." },
```

with:

```js
      motifs:     { path: "/motifs", title: "Motifs & Meaning | Alana Wina Trudi", desc: "How to read Dayak beadwork: the two-world cosmology, the figures that populate it, what the colours mean, and why the forms repeat." },
```

- [ ] **Step 2: Build and check the baked meta**

Run: `node build.mjs` → passes.
Run: `grep -c "two-world cosmology" dist/motifs.html` → ≥`1` (desc is baked into several meta tags, so >1 is fine).

- [ ] **Step 3: Acceptance greps on the motifs block**

Extract the motifs block and check the no-product rule and section order:

```bash
awk '/================= MOTIFS/{f=1} /================= WHOLESALE/{f=0} f' index.html > /tmp/motifs-block.html
grep -icE "earring|tote|pouch|crossbody|wristlet|coaster|placemat|keychain|cuff|necklace|hanging|sku" /tmp/motifs-block.html   # expected: 0
grep -c 'id="motif-' /tmp/motifs-block.html   # expected: 4
grep -n "Two worlds, held in balance\|The figures\|Colour as prayer\|Form, movement, sound\|The beads themselves\|A note on cultural respect" /tmp/motifs-block.html
# expected: six matches, line numbers strictly increasing in that order
```

- [ ] **Step 4: Browser verification (desktop and mobile)**

Preview server `awt-beads` on port 8899. Navigate to `http://localhost:8899/motifs`, reload after build.

- Desktop: screenshot the page top (new H1 + §1), the colour grid, and §4/§5. Verify no console errors, all six swatches visible, image slots render as placeholders.
- Mobile: `resize_window` to the mobile preset, reload, screenshot the colour grid — chips must wrap legibly (acceptance criterion 3), then restore desktop.

- [ ] **Step 5: Commit and push**

```bash
git add index.html
git commit -m "Point the motifs route description at the new page scope

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 6: Verify live**

Poll `https://beads.alwintru.com/motifs` until `grep -c "two-world cosmology"` on the fetched HTML ≥ 1, then fetch the page and confirm "How to read the beadwork" and "Colour as prayer" are present. Load the live page in the browser pane and screenshot the colour grid as proof.

---

## Self-review

- **Spec coverage:** §0→Task 1 · §1→Task 1 · §2 (intro + three edits, mata punai untouched)→Task 2 · §3 (grid, hexes, Kenyah closer)→Task 3 · §4+§5+§6→Task 4 · ROUTES desc + acceptance criteria 1–5→Task 5. Nothing in the spec is unassigned.
- **Placeholder scan:** all copy is final text; all greps have expected values; no TBDs.
- **Type consistency:** section anchors chain correctly — each task's insert anchor is produced verbatim by the previous task (Task 3's anchor includes Task 3 Step 1's own edit only after it is applied; Step 1 precedes Step 2 within the task, so the order holds). Swatch hexes match the spec's six values exactly.
