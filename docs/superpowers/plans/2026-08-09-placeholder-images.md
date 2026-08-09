# Placeholder Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Controller note:** every task depends on the Canva MCP connector and visual candidate review in the browser pane — session-bound resources. Inline execution is the intended mode.

**Goal:** Fill 15 still-life placeholders with Canva-generated images that pass the naturalness gate, per the approved spec.

**Architecture:** One Canva generation job per image (4 candidates each), reviewed on contact sheets then at full resolution against the gate; accepted candidates become designs, are exported 1080×1350 JPEG, downloaded into new `images/` subfolders, and wired into `index.html` (static slots → `<img>` cover; product cards → `src` + `bleed`). Commit per task group; push and live-verify at the end.

**Tech Stack:** Canva MCP (generate-design, create-design-from-candidate, export-design, move-item-to-folder), browser pane for review, `node build.mjs`, preview server `awt-beads` (port 8899).

**Spec:** `docs/superpowers/specs/2026-08-09-placeholder-images-design.md`

## Global Constraints

- Every image generated as `instagram_post` (1080×1350, 4:5); key subject inside the central ~80% so 1:1 and 3:2 `object-fit:cover` crops lose nothing.
- **COMMON BLOCK** — appended verbatim to every prompt below (the cuff prompt replaces its no-people sentence as noted):
  > Photorealistic photograph shot on an 85mm macro lens at f/4 in soft natural window light from the left, one clean shadow, faint film grain, no HDR, no dreamy glow, colours true to life. Handmade imperfection is essential: bead rows slightly uneven, a hint of cotton thread visible where rows turn, the work clearly made by hand, nothing machine-perfect. Beads are tiny opaque glass seed beads, every individual bead a distinct visible grain. NO text anywhere — no lettering, caption, logo or watermark. No bone, tusk, shell, wood or carved charms. No people, faces or hands. Portrait 4:5 composition.
- Research-grounded motif language (from Met/Penn/collector sources): plaited European seed beads stitched over cloth; curves smooth, narrowing to a single bead's width; fields dominantly black/yellow/white with red/green/blue touches.
- Naturalness gate (spec): review each candidate on a contact sheet, then the chosen one at full resolution via Read before wiring. Reject: impossible bead physics, plastic/CGI sheen, perfect per-bead mirror symmetry, garbled motif geometry, any text/brand, missing shadows, any person (except the cuff's wrist). Known generator failure modes to expect and reject: invented brands/URLs, `reallygreatsite.com`, fake testimonials, unrelated stock content.
- Cuff image only: wrist/forearm allowed and required; extra gate — correct anatomy, natural skin texture with pores and fine lines, no waxy AI skin, believable contact shadow under the cuff; framed forearm-only, no face.
- File names/dirs exactly as the spec's tables (`images/motifs/…`, `images/categories/…`, `images/products/…`, `images/about/beads.jpg`).
- Static slot wiring pattern — replace the whole `<image-slot …></image-slot>` element (keep its surrounding aspect-ratio `div` and caption untouched):
  `<img src="/images/<dir>/<file>.jpg" alt="<alt text per task>" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>`
- Rejected/superseded Canva designs → folder `FAHRwiXPMOM` (existing archive). Shipped designs stay at top level.
- Commits end with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Push only in Task 4.

---

### Task 1: Motif macros (4 images → Motifs page)

**Files:**
- Create: `images/motifs/aso.jpg`, `images/motifs/tinggang.jpg`, `images/motifs/kelunan.jpg`, `images/motifs/borders.jpg`
- Modify: `index.html` — the four `image-slot` elements `motif-aso`, `motif-tinggang`, `motif-kelunan`, `motif-borders`

**Interfaces:**
- Produces: the wiring pattern proven for Tasks 2/4 (same `<img>` replacement).

- [ ] **Step 1: Generate four jobs** (one per image; each prompt = text below + COMMON BLOCK)

*aso:* "Extreme close-up of flat hand-woven Dayak beadwork filling the entire frame edge to edge, no background, no staging. On a jet-black field of tiny beads, curling hook-and-spiral scrollwork in vermilion red outlined in chalk white — smooth tendril curves that coil and double back like fern heads, narrowing to a single bead's width at their tips, with a few chrome yellow accents. At one edge a sliver of the faded red trade cloth the panel is stitched onto shows. This is the aso' dragon-dog pattern of Kayan and Kenyah beadwork: curvilinear scrolls, NOT chevrons, NOT diamonds."

*tinggang:* "Extreme close-up of flat hand-woven Dayak beadwork filling the entire frame edge to edge, no background, no staging. On a jet-black field of tiny beads, long sweeping curved lines in chrome yellow and chalk white trace a stylised hornbill — the deep curve of its casque and the long arc of its tail feathers — drawn entirely in beads, the curves smooth and narrowing to a single bead's width, with small vermilion red accents at the head."

*kelunan:* "Extreme close-up of flat hand-woven Dayak beadwork filling the entire frame edge to edge, no background, no staging. A single standing human figure with raised arms, faceted into the stepped bead grid like cross-stitch: ochre-yellow body outlined in jet black on a cream-white bead field, blocky and pixel-like, with a red band across the base of the panel."

*borders:* "Extreme close-up of flat hand-woven Dayak beadwork filling the entire frame edge to edge, no background, no staging. Horizontal repeating border rows: a row of small diamond dove's-eye motifs each with a single contrasting centre bead, then a zigzag row, then a row of small paired hooks, repeating. Black, chrome yellow and chalk white dominate, with one vermilion red row and one emerald green row as accents."

- [ ] **Step 2: Review candidates** — contact sheet in a fresh browser tab (design.canva.ai thumbnail IDs), reject per gate, retry any image with no clean candidate (adjust its prompt's failing aspect; max 2 retries per image before flagging to the user).
- [ ] **Step 3: Save + export chosen four** — create-design-from-candidate → export jpg quality 92, 1080×1350 → curl into `images/motifs/`. Verify: `file` says JPEG, `sips` says 1080x1350.
- [ ] **Step 4: Full-resolution gate** — Read each of the four JPEGs; check against the naturalness gate and motif-recognisability (aso' curvilinear, kelunan readable figure, borders diamond rows).
- [ ] **Step 5: Wire** — replace each of the four `image-slot` elements with the Global-Constraints `<img>` pattern. Alt texts: "Macro of aso' beadwork: red and white hooks and spirals on black", "Macro of hornbill beadwork: yellow curved casque and tail lines on black", "Macro of kelunan beadwork: standing figure with raised arms", "Macro of Dayak border beadwork: diamond, zigzag and hook rows".
- [ ] **Step 6: Verify** — `node build.mjs` passes; `grep -c 'id="motif-' index.html` → 0; `grep -c "images/motifs/" index.html` → 4. Browser: `http://localhost:8899/motifs`, scroll the four family sections, confirm images render inside the square boxes with captions intact.
- [ ] **Step 7: Commit**

```bash
git add images/motifs index.html
git commit -m "Fill the four motif macro slots with generated beadwork close-ups

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Category shots (4 images → home page)

**Files:**
- Create: `images/categories/decor.jpg`, `images/categories/jewelry.jpg`, `images/categories/keychains.jpg`, `images/categories/table.jpg`
- Modify: `index.html` — `image-slot` elements `cat-decor`, `cat-jewelry`, `cat-keychains`, `cat-table`

**Interfaces:**
- Consumes: wiring pattern from Task 1.

- [ ] **Step 1: Generate four jobs** (prompt + COMMON BLOCK)

*decor:* "A beaded Dayak wall panel hanging on a warm cream plaster wall above a woven rattan bench, afternoon light raking across. The panel: long curved yellow and white bird-like lines on a black bead field, red accents, short bead fringe along its lower edge."

*jewelry:* "A beaded strand necklace in cocoa, cream and red glass seed beads, and a wide beaded cuff with a black field and multicoloured border rows, both resting on a rough natural grey stone slab, hard directional light, deep shadows."

*keychains:* "A dozen small beaded keychain tags, each a different diamond or zigzag border pattern in black, yellow, white, red and green beads, with small brass split rings, heaped casually in a round woven rattan counter tray on pale linen, shallow depth of field."

*table:* "A long beaded table runner worked in oat and cocoa border-pattern rows laid down a rustic dark wood table, with a folded undyed linen napkin and a matte stoneware plate set on it, low warm side light."

- [ ] **Step 2–4:** same review → save/export → full-res gate flow as Task 1, into `images/categories/`.
- [ ] **Step 5: Wire** — replace the four slots. Alt texts: "Beaded wall panel above a rattan bench", "Beaded necklace and cuff on natural stone", "Beaded keychains in a rattan counter tray", "Beaded table runner set with linen and stoneware".
- [ ] **Step 6: Verify** — build passes; `grep -c 'id="cat-' index.html` → 0; browser check of the home page category grid (4:5 boxes filled, hover zoom still works — the `.imgwrap > *` transition applies to the new imgs).
- [ ] **Step 7: Commit** (message: "Fill the four home category slots with generated still-lifes" + trailer)

---

### Task 3: Product cards (6 images → Collection page)

**Files:**
- Create: `images/products/placemats.jpg`, `coasters.jpg`, `hanging.jpg`, `necklace.jpg`, `cuff.jpg`, `keychains.jpg`
- Modify: `index.html` — the six catalog entries (`placemats`, `coasters`, `hanging`, `necklace`, `cuff`, `keychains`): add `src: '/images/products/<id>.jpg', bleed: true,` after the `motif:` field, mirroring the earring entries' shape

**Interfaces:**
- Consumes: the catalog's existing `hasImg/bleedImg` mechanism (no template change needed).

- [ ] **Step 1: Generate six jobs** (prompt + COMMON BLOCK)

*placemats:* "Top-down photograph of a rectangular hand-beaded placemat in oat and cocoa border-pattern rows on a rustic wood table, a matte ceramic plate and brass cutlery set on it, the corner of a second matching mat entering the frame edge."

*coasters:* "Six round hand-beaded coasters, each a different small border pattern — diamonds, zigzags, hooks — in black, yellow, white, red and green, fanned in an arc on a natural grey stone surface beside a glass of pale tea, top-down, hard light."

*hanging:* "A long narrow beaded wall hanging: a column of cream standing figures with raised arms on a cocoa bead ground, hung from a plain wooden batten beside an undyed linen curtain, soft morning light, short bead fringe at the bottom."

*necklace:* "Five counted strands of cocoa, cream and red glass seed beads gathered toward a small beaded pendant figure, lying on a rough natural grey stone slab, macro distance, one hard shadow."

*cuff (uses the wrist exception — replace the COMMON BLOCK's no-people sentence with the following):* "A wide hand-beaded cuff — jet-black bead field wrapped in multicoloured border rows — worn on a wrist, the forearm resting on the arm of a woven rattan chair. Frame the forearm and wrist only, no face, no second person, sleeve of plain linen at the frame edge. The skin is real and natural: visible pores, fine lines and small natural marks, true skin tones, absolutely no waxy or airbrushed smoothing, and the cuff presses a soft believable contact shadow into the skin."

*keychains (product):* "Twelve small beaded tags, each a different border pattern, with brass split rings, arranged in a round rattan tray on a pale wooden shop counter, shallow depth of field, one tag lying outside the tray."

- [ ] **Step 2–4:** review → save/export → full-res gate, into `images/products/`. The cuff additionally passes the skin gate at full resolution.
- [ ] **Step 5: Wire** — add `src` + `bleed: true` to the six entries (Edit per entry, anchored on `{ id: '<id>', name:`).
- [ ] **Step 6: Verify** — build passes; `grep -o "src: '/images/products/[a-z]*\.jpg', bleed: true" index.html | wc -l` → 6; browser: Collection page shows 26 photo cards / 6 remaining placeholders are gone from the product grid (only modal `d1/d2` slots remain site-wide with `hero-hands` etc.); cards render edge-to-edge like the earrings; open one modal to confirm the big image renders.
- [ ] **Step 7: Commit** (message: "Give the six imageless catalog products generated photography" + trailer)

---

### Task 4: About-beads, push, live verification, Canva tidy-up

**Files:**
- Create: `images/about/beads.jpg`
- Modify: `index.html` — `image-slot` element `about-beads`

- [ ] **Step 1: Generate** (prompt + COMMON BLOCK): "Top-down photograph of shallow wooden sorting trays holding loose vivid glass seed beads sorted by colour — vermilion red, chrome yellow, jet black, chalk white, emerald green, cobalt blue — a few beads scattered on the pale linen beside the trays, no scoop, no tools."
- [ ] **Step 2–4:** review → save/export → full-res gate, into `images/about/beads.jpg`.
- [ ] **Step 5: Wire** — replace the `about-beads` slot; alt "Glass seed beads sorted by colour in wooden trays".
- [ ] **Step 6: Verify whole site** — build; remaining `image-slot` count in `index.html` = 6 static (hero-hands, home-hands, about-portrait, about-group, about-village, about-river) + the 2 template (`{{ p.imgId }}`, `{{ product.imgId }}`) references; browser pass over home, collection, motifs, our-makers pages.
- [ ] **Step 7: Commit + push** ("Fill the bead-tray about slot and complete the still-life image set" + trailer), then `git push origin main`.
- [ ] **Step 8: Live verification** — poll `https://beads.alwintru.com` until all 15 image URLs return checksums identical to local (cache-busted); load `/motifs` and `/collection` live in the browser pane, screenshot as proof.
- [ ] **Step 9: Canva tidy-up** — move rejected/duplicate generated designs to archive folder `FAHRwiXPMOM`; leave the 15 shipped designs at top level; report design IDs.

---

## Self-review

- **Spec coverage:** 15 files ↔ spec tables A–D all present; naturalness gate + cuff skin gate in Global Constraints and Steps; no-people rule with single exception; cover-crop strategy; bleed wiring; archive tidy-up; live verification. Excluded slots preserved (Task 4 Step 6 counts them).
- **Placeholder scan:** all 15 prompts written in full; alt texts written; grep expectations concrete. No TBDs.
- **Consistency:** wiring pattern defined once in Global Constraints and referenced; file paths match the spec exactly; `cat-decor` depicts bird-like lines per spec note; cuff prompt overrides the COMMON BLOCK sentence exactly as the spec's exception describes.
