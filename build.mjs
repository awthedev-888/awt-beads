// Pre-render one HTML file per route so <title>, description, canonical and the
// og:/twitter: tags are correct in the STATIC head — before any JavaScript runs.
// Social unfurlers and non-rendering crawlers never execute JS, so without this
// every route would advertise the homepage's title.
//
// Route metadata is read out of the ROUTES() method inside index.html, so this
// script and the running app can never disagree about titles or descriptions.
//
// Run: node build.mjs      (Cloudflare Pages runs it as the build command)

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SITE = 'https://beads.alwintru.com';
const OUT = 'dist';                 // published directory; index.html stays pure source
const src = readFileSync('index.html', 'utf8');

// --- single source of truth: parse the app's own ROUTES() table --------------
// Read, never evaluate: the table is matched with a strict regex so nothing in
// index.html can be executed by the build.
const block = src.match(/ROUTES\(\)\s*\{\s*return \{([\s\S]*?)\n    \};/);
if (!block) throw new Error('build: could not find the ROUTES() table in index.html');

const routes = {};
const ENTRY = /(\w+):\s*\{\s*path:\s*"([^"]*)",\s*title:\s*"([^"]*)",\s*desc:\s*"([^"]*)"\s*\}/g;
for (const [, key, path, title, desc] of block[1].matchAll(ENTRY)) routes[key] = { path, title, desc };

const names = Object.keys(routes);
if (!names.length) throw new Error('build: parsed no routes — check the ROUTES() formatting rules');

// Short, factual copy shown only when JavaScript is unavailable.
const NOSCRIPT = {
  home: ['Beadwork from the Bead Village.',
    'Alana Wina Trudi brings to you the hand-beaded Dayak craft of home décor, jewelry, bags and small accessories, beaded one glass bead at a time by the women of Kampung Manik, Samarinda. Wholesale only, shipped worldwide from Indonesia.'],
  collection: ['Hand-beaded, piece by piece',
    'Every piece is beaded in Kampung Manik on glass seed beads, cotton and rattan. Wholesale prices are quoted in EUR or USD and live in the line sheet.'],
  motifs: ['How to read the beadwork',
    "Dayak beadwork carries an old cosmology in colour, figure and form: two worlds held in balance, the figures that populate them, colours with meanings, and forms that repeat."],
  wholesale: ['How buying works',
    'Request the line sheet, order samples, then place your first order. Samples ship by courier from Samarinda; volume orders go sea LCL out of Balikpapan. Incoterms EXW Samarinda or FOB Balikpapan.'],
  about: ['Kampung Manik, the Bead Village',
    'One neighbourhood in Samarinda, on the Mahakam River, where beadwork is the daily craft of its women. This is where every piece we sell is made.'],
  contact: ['Reach Samarinda',
    'Email hello@alwintru.com, or message us on WhatsApp. We reply within two business days, Samarinda time (WITA, UTC+8).'],
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Replace one attribute on the single tag matched by `pattern`; throws if absent,
// so a markup change in index.html fails the build instead of shipping stale tags.
function setAttr(html, pattern, attr, value, label) {
  const re = new RegExp(`(${pattern}[^>]*?${attr}=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`build: ${label} not found in index.html`);
  return html.replace(re, `$1${esc(value)}$2`);
}

function render(key) {
  const r = routes[key];
  const url = SITE + r.path;
  let html = src;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(r.title)}</title>`);
  html = setAttr(html, '<meta name="description"', 'content', r.desc, 'meta description');
  html = setAttr(html, '<meta property="og:title"', 'content', r.title, 'og:title');
  html = setAttr(html, '<meta property="og:description"', 'content', r.desc, 'og:description');
  html = setAttr(html, '<meta property="og:url"', 'content', url, 'og:url');
  html = setAttr(html, '<meta name="twitter:title"', 'content', r.title, 'twitter:title');
  html = setAttr(html, '<meta name="twitter:description"', 'content', r.desc, 'twitter:description');
  html = setAttr(html, '<link rel="canonical"', 'href', url, 'canonical');

  // Readable fallback for visitors and crawlers without JavaScript. It sits
  // outside <x-dc>, which the runtime replaces wholesale on hydration.
  const [heading, intro] = NOSCRIPT[key] ?? [r.title, r.desc];
  const nav = names.filter((n) => n !== key)
    .map((n) => `<li><a href="${routes[n].path}">${esc(routes[n].title.split(' | ')[0])}</a></li>`).join('');
  const noscript = `<noscript><div style="max-width:44rem;margin:0 auto;padding:2rem 1.5rem;font-family:Karla,sans-serif;color:#34291D">`
    + `<h1 style="font-family:'Young Serif',serif;font-weight:400">${esc(heading)}</h1>`
    + `<p style="line-height:1.65">${esc(intro)}</p>`
    + `<p style="line-height:1.65">Wholesale only. Email <a href="mailto:hello@alwintru.com">hello@alwintru.com</a>.</p>`
    + `<ul>${nav}</ul></div></noscript>`;
  html = html.replace('<x-dc>', `${noscript}\n<x-dc>`);

  return html;
}

// Everything is written into dist/ so index.html is never mutated by the build
// and re-running is always idempotent.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Each route becomes a FLAT <path>.html. Cloudflare Pages serves /collection
// straight from collection.html with a 200. Using collection/index.html instead
// makes Pages 308-redirect /collection to /collection/, which would contradict
// the canonical URL the page declares.
for (const key of names) {
  const rel = routes[key].path === '/' ? 'index.html' : routes[key].path.replace(/^\//, '') + '.html';
  const out = join(OUT, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render(key));
  console.log(`  ${routes[key].path.padEnd(14)} -> ${rel}`);
}

// Static assets referenced by the pages, copied verbatim.
const ASSETS = ['support.js', 'image-slot.js', 'bead-band.svg', 'logo.png', 'logo-180.png',
                'logo-32.png', 'og-1200x630.jpg', 'robots.txt', 'sitemap.xml', '_redirects', 'images'];
let copied = 0;
for (const a of ASSETS) {
  if (!existsSync(a)) { console.warn(`  ! missing asset: ${a}`); continue; }
  cpSync(a, join(OUT, a), { recursive: true });
  copied++;
}
console.log(`built ${names.length} routes, copied ${copied}/${ASSETS.length} assets into ${OUT}/`);
