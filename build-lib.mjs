import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { allIndexableRoutes, productPath } from './site-routes.mjs';

const STATIC_ASSETS = [
  'support.js',
  'image-slot.js',
  'bead-band.svg',
  'logo.png',
  'logo-180.png',
  'logo-32.png',
  'og-1200x630.jpg',
  'robots.txt',
  'sitemap.xml',
  'images'
];

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': '#organization',
  name: 'Alana Wina Trudi',
  email: 'beads@alwintru.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Samarinda',
    addressRegion: 'East Kalimantan',
    addressCountry: 'ID'
  }
};

export function outputFileForPath(outDir, path) {
  return path === '/'
    ? join(outDir, 'index.html')
    : join(outDir, `${path.replace(/^\//, '')}.html`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function absoluteUrl(siteUrl, path) {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function setAttribute(html, pattern, attribute, value, label) {
  const expression = new RegExp(`(${pattern}[^>]*?${attribute}=")[^"]*(")`);
  if (!expression.test(html)) throw new Error(`build: ${label} not found in index.html`);
  return html.replace(expression, `$1${escapeHtml(value)}$2`);
}

function injectJsonMarker(html, id, value) {
  const marker = new RegExp(`<script type="application/json" id="${id}">[\\s\\S]*?<\\/script>`);
  if (!marker.test(html)) throw new Error(`build: #${id} marker not found in index.html`);
  return html.replace(marker, `<script type="application/json" id="${id}">${escapeJsonForHtml(value)}</script>`);
}

function injectFormEndpoint(html, formEndpoint) {
  if (formEndpoint === undefined) return html;
  const pattern = /(\&quot;formEndpoint\&quot;:[\s\S]*?\&quot;default\&quot;: \&quot;)[^&]*(\&quot;)/;
  if (!pattern.test(html)) throw new Error('build: formEndpoint default not found in index.html');
  return html.replace(pattern, `$1${escapeHtml(formEndpoint)}$2`);
}

function structuredData(route, siteUrl) {
  const url = absoluteUrl(siteUrl, route.path);
  const organization = { ...ORGANIZATION, '@id': `${siteUrl}/#organization`, url: `${siteUrl}/`, logo: `${siteUrl}/logo.png` };
  return {
    '@context': 'https://schema.org',
    '@graph': [organization, { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: route.title, description: route.description }]
  };
}

function fallbackContent(route, catalogue) {
  let detail = '';
  if (route.kind === 'category') {
    const products = catalogue.products
      .filter(product => product.status === 'active' && product.categoryId === route.category.id)
      .map(product => `<li><a href="${productPath(product, catalogue)}">${escapeHtml(product.name)}</a></li>`)
      .join('');
    detail = products ? `<ul>${products}</ul>` : '';
  } else if (route.kind === 'product') {
    const specs = [route.product.materials, route.product.dimensions, route.product.colours]
      .filter(Boolean)
      .map(value => `<li>${escapeHtml(value)}</li>`)
      .join('');
    detail = `${specs ? `<ul>${specs}</ul>` : ''}<p><a href="/wholesale#linesheet-form">Contact us about wholesale availability</a>.</p>`;
  }
  return `<noscript><main style="max-width:44rem;margin:0 auto;padding:2rem 1.5rem;font-family:Karla,sans-serif;color:#34291D"><h1 style="font-family:'Young Serif',serif;font-weight:400">${escapeHtml(route.kind === 'product' ? route.product.name : route.kind === 'category' ? route.category.name : route.title.split(' | ')[0])}</h1><p style="line-height:1.65">${escapeHtml(route.description)}</p>${detail}<p><a href="/collection">Explore the collection</a> · <a href="/contact">Contact</a></p></main></noscript>`;
}

function renderRoute(source, route, catalogue, routes, siteUrl, formEndpoint) {
  const canonical = absoluteUrl(siteUrl, route.path);
  const image = absoluteUrl(siteUrl, route.ogImage || '/og-1200x630.jpg');
  let html = source;
  html = injectJsonMarker(html, 'awt-catalogue', catalogue);
  html = injectJsonMarker(html, 'awt-route-data', routes.map(({ category, product, ...record }) => record));
  html = injectFormEndpoint(html, formEndpoint);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`);
  html = setAttribute(html, '<meta name="description"', 'content', route.description, 'meta description');
  html = setAttribute(html, '<meta property="og:title"', 'content', route.title, 'og:title');
  html = setAttribute(html, '<meta property="og:description"', 'content', route.description, 'og:description');
  html = setAttribute(html, '<meta property="og:url"', 'content', canonical, 'og:url');
  html = setAttribute(html, '<meta property="og:image"', 'content', image, 'og:image');
  html = setAttribute(html, '<meta property="og:image:alt"', 'content', route.kind === 'product' ? route.product.alt : route.title, 'og:image:alt');
  html = setAttribute(html, '<meta name="twitter:title"', 'content', route.title, 'twitter:title');
  html = setAttribute(html, '<meta name="twitter:description"', 'content', route.description, 'twitter:description');
  html = setAttribute(html, '<meta name="twitter:image"', 'content', image, 'twitter:image');
  html = setAttribute(html, '<meta name="twitter:image:alt"', 'content', route.kind === 'product' ? route.product.alt : route.title, 'twitter:image:alt');
  html = setAttribute(html, '<link rel="canonical"', 'href', canonical, 'canonical');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${escapeJsonForHtml(structuredData(route, siteUrl))}</script>`);
  html = html.replace('<x-dc>', `${fallbackContent(route, catalogue)}\n<x-dc>`);
  return html;
}

function redirectRules() {
  return '# Generated by buildSite.\n/*  /index.html  200\n';
}

export async function buildSite({ rootDir, outDir, siteUrl, formEndpoint }) {
  if (!rootDir) throw new Error('build: rootDir is required');
  if (!outDir) throw new Error('build: outDir is required');
  if (!siteUrl) throw new Error('build: siteUrl is required');

  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');
  const resolvedOutDir = isAbsolute(outDir) ? outDir : join(rootDir, outDir);
  const [source, rawCatalogue] = await Promise.all([
    readFile(join(rootDir, 'index.html'), 'utf8'),
    readFile(join(rootDir, 'catalogue.json'), 'utf8')
  ]);
  const catalogue = JSON.parse(rawCatalogue);
  const routes = allIndexableRoutes(catalogue);

  await rm(resolvedOutDir, { recursive: true, force: true });
  await mkdir(join(resolvedOutDir, 'server'), { recursive: true });
  await writeFile(join(resolvedOutDir, 'server/index.js'), `export default {\n  async fetch(request, env) {\n    return env.ASSETS.fetch(request);\n  }\n};\n`);

  const manifestRoutes = [];
  for (const route of routes) {
    const output = outputFileForPath(resolvedOutDir, route.path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, renderRoute(source, route, catalogue, routes, normalizedSiteUrl, formEndpoint));
    manifestRoutes.push({ path: route.path, output, kind: route.kind });
  }

  await Promise.all(STATIC_ASSETS.map(asset => cp(join(rootDir, asset), join(resolvedOutDir, asset), { recursive: true })));
  const sitemapUrls = routes.map(route => absoluteUrl(normalizedSiteUrl, route.path));
  await writeFile(join(resolvedOutDir, '_redirects'), redirectRules());

  return { routes: manifestRoutes, sitemapUrls };
}
