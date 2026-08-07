# AWT Beads — Alana Wina Trudi

Wholesale website for **Alana Wina Trudi**: hand-beaded Dayak craft from Kampung Manik ("the Bead Village"), Samarinda, East Kalimantan, Indonesia. Home décor, jewelry, bags and table textiles, beaded by hand and sold wholesale to European retailers.

**Live site:** https://beads.alwintru.com/

## Stack

Static site — no build step. `index.html` is a self-contained prototype rendered by a small runtime:

- `index.html` — all six screens (Home, Collection, Motifs & Meaning, Wholesale, Our Makers, Contact), styles, and component logic
- `support.js` — the DC runtime that renders the template (React-based, loaded at runtime)
- `image-slot.js` — image placeholder component (product photography not yet shot)
- `bead-band.svg` — the beadwork band used as a decorative divider

## Deployment

Deployed on **Cloudflare Pages**, connected to this repo. Every push to `main` redeploys automatically. No build command; output directory is the repo root.

## Before launch checklist

- [ ] Product & village photography — fills the `image-slot` placeholders
- [ ] `og-1200x630.jpg` and `logo.png` (referenced in `<head>`, don't exist yet)
- [ ] Confirm Instagram handle (@alwintru) and WhatsApp number (placeholders in Contact)
- [ ] Faire / Ankorstore marketplace links (marked "link TBD")
- [ ] Line-sheet form endpoint (`formEndpoint` prop — currently demo mode, logs to console)
