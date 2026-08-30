import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { allIndexableRoutes, productPath } from './site-routes.mjs';

const STATIC_ASSETS = [
  'enquiry.js',
  'support.js',
  'image-slot.js',
  'bead-band.svg',
  'logo.png',
  'logo-180.png',
  'logo-32.png',
  'og-1200x630.jpg',
  'robots.txt',
  'images'
];

const PUBLIC_CATEGORY_FIELDS = [
  'id', 'name', 'slug', 'image', 'alt', 'description'
];

const PUBLIC_PRODUCT_FIELDS = [
  'id', 'name', 'slug', 'categoryId', 'status', 'image', 'alt', 'summary',
  'description', 'productionLocation', 'gallery', 'materials', 'dimensions',
  'weight', 'colours', 'hardware', 'closure', 'care', 'hsCode', 'variationNote'
];

const PUBLIC_PROVENANCE_FIELDS = [
  'classification', 'visualDescription', 'motifName', 'community', 'meaning'
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

function publicFields(record, fields) {
  return Object.fromEntries(fields
    .filter(field => Object.prototype.hasOwnProperty.call(record, field))
    .map(field => [field, record[field]]));
}

export function publicCatalogueProjection(catalogue) {
  return {
    categories: catalogue.categories.map(category => publicFields(category, PUBLIC_CATEGORY_FIELDS)),
    products: catalogue.products
      .filter(product => product.status === 'active')
      .map(product => ({
        ...publicFields(product, PUBLIC_PRODUCT_FIELDS),
        provenance: publicFields(product.provenance || {}, PUBLIC_PROVENANCE_FIELDS)
      }))
  };
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
  const graph = [organization];

  if (route.kind === 'category' || route.key === 'collection') {
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${url}#collection`,
      url,
      name: route.heading,
      description: route.description
    });
  } else if (route.kind === 'product') {
    const product = {
      '@type': 'Product',
      '@id': `${url}#product`,
      url,
      name: route.product.name,
      description: route.product.description,
      image: absoluteUrl(siteUrl, route.product.image),
      category: route.category.name,
      productID: route.product.id
    };
    if (route.product.materials) product.material = route.product.materials;
    if (route.product.productionLocation) {
      product.additionalProperty = [{
        '@type': 'PropertyValue',
        name: 'Production location',
        value: route.product.productionLocation
      }];
    }
    graph.push(product);
  }

  if (route.path !== '/') {
    const crumbs = [{ name: 'Home', path: '/' }];
    if (route.kind === 'category' || route.kind === 'product' || route.key === 'collection') {
      crumbs.push({ name: 'Collection', path: '/collection' });
    }
    if (route.kind === 'category' || route.kind === 'product') {
      crumbs.push({ name: route.category.name, path: route.kind === 'category' ? route.path : `/collection/${route.category.slug}` });
    }
    if (route.kind === 'product') crumbs.push({ name: route.product.name, path: route.path });
    if (route.kind === 'primary' && route.key !== 'collection') crumbs.push({ name: route.heading, path: route.path });
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(siteUrl, crumb.path)
      }))
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

const PRODUCT_FACTS = [
  ['Materials', 'materials'],
  ['Dimensions', 'dimensions'],
  ['Weight', 'weight'],
  ['Colours', 'colours'],
  ['Hardware', 'hardware'],
  ['Care', 'care'],
  ['Production location', 'productionLocation'],
  ['HS code', 'hsCode'],
  ['Variation', 'variationNote']
];

function provenanceDisplay(product) {
  if (!product.provenance) return '';
  if (product.provenance.classification === 'contemporary-borneo') return 'Contemporary Borneo beadwork.';
  if (product.provenance.classification === 'contemporary-decorative') return 'Contemporary decorative beadwork.';
  if (product.provenance.classification === 'verified-heritage') {
    const context = [product.provenance.motifName, product.provenance.community].filter(Boolean).join(' · ');
    return context ? `Verified heritage beadwork: ${context}.` : 'Verified heritage beadwork.';
  }
  return '';
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
    const specs = PRODUCT_FACTS
      .filter(([, field]) => route.product[field])
      .map(([label, field]) => `<dt>${label}</dt><dd>${escapeHtml(route.product[field])}</dd>`)
      .join('');
    const provenance = provenanceDisplay(route.product);
    detail = `${specs ? `<dl>${specs}</dl>` : ''}${provenance ? `<p>${escapeHtml(provenance)}</p>` : ''}<p><a href="/wholesale#wholesale-enquiry">Enquire about this piece</a>.</p>`;
  }
  return `<main id="awt-static-fallback" style="max-width:44rem;margin:0 auto;padding:2rem 1.5rem;font-family:Karla,sans-serif;color:#34291D"><h1 style="font-family:'Young Serif',serif;font-weight:400">${escapeHtml(route.heading)}</h1><p style="line-height:1.65">${escapeHtml(route.description)}</p>${detail}<p><a href="/collection">Explore the collection</a> · <a href="/contact">Contact</a></p></main>`;
}

function renderRoute(source, route, catalogue, publicCatalogue, routes, siteUrl, formEndpoint) {
  const canonical = absoluteUrl(siteUrl, route.path);
  const image = absoluteUrl(siteUrl, route.ogImage || '/og-1200x630.jpg');
  const imageAlt = route.ogImageAlt || route.title;
  let html = source;
  html = injectJsonMarker(html, 'awt-catalogue', publicCatalogue);
  html = injectJsonMarker(html, 'awt-route-data', routes.map(({ category, product, ...record }) => record));
  html = injectFormEndpoint(html, formEndpoint);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`);
  html = setAttribute(html, '<meta name="description"', 'content', route.description, 'meta description');
  html = setAttribute(html, '<meta property="og:title"', 'content', route.title, 'og:title');
  html = setAttribute(html, '<meta property="og:description"', 'content', route.description, 'og:description');
  html = setAttribute(html, '<meta property="og:url"', 'content', canonical, 'og:url');
  html = setAttribute(html, '<meta property="og:image"', 'content', image, 'og:image');
  html = setAttribute(html, '<meta property="og:image:alt"', 'content', imageAlt, 'og:image:alt');
  html = setAttribute(html, '<meta name="twitter:title"', 'content', route.title, 'twitter:title');
  html = setAttribute(html, '<meta name="twitter:description"', 'content', route.description, 'twitter:description');
  html = setAttribute(html, '<meta name="twitter:image"', 'content', image, 'twitter:image');
  html = setAttribute(html, '<meta name="twitter:image:alt"', 'content', imageAlt, 'twitter:image:alt');
  html = setAttribute(html, '<link rel="canonical"', 'href', canonical, 'canonical');
  if (route.ogImage && route.ogImage !== '/og-1200x630.jpg') {
    html = html.replace(/\s*<meta property="og:image:(?:width|height)"[^>]*>/g, '');
  }
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${escapeJsonForHtml(structuredData(route, siteUrl))}</script>`);
  html = html.replace('<x-dc>', `${fallbackContent(route, catalogue)}\n<x-dc>`);
  return html;
}

function notFoundDocument() {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Page not found | Alana Wina Trudi</title>
</head>
<body style="margin:0;background:#F7F1E5;color:#34291D;font-family:Karla,Arial,sans-serif">
<main style="max-width:44rem;margin:0 auto;padding:4rem 1.5rem">
<p style="font:600 0.75rem Archivo,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8E2321">404</p>
<h1>Page not found</h1>
<p style="line-height:1.65">The page you requested is not part of the current Alana Wina Trudi wholesale website.</p>
<p><a href="/collection">Explore the collection</a> · <a href="/contact">Contact</a></p>
</main>
</body>
</html>
`;
}

function sitemapDocument(routes, siteUrl) {
  const entries = routes
    .map(route => `  <url>\n    <loc>${escapeHtml(absoluteUrl(siteUrl, route.path))}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function redirectRules(catalogue) {
  const jewelryCategoryIds = new Set(['earrings', 'necklaces', 'bracelets']);
  const jewelryRules = catalogue.products
    .filter(product => product.status === 'active' && jewelryCategoryIds.has(product.categoryId))
    .map(product => `/collection/jewelry/${product.slug}  ${productPath(product, catalogue)}  301`)
    .sort();
  return [
    '# Generated by buildSite.',
    '/collection/table-textiles  /collection/table-runners  301',
    '/collection/table-textiles/manik-coaster-set-6  /collection/coasters  301',
    '/collection/table-textiles/*  /collection/table-runners/:splat  301',
    ...jewelryRules,
    ''
  ].join('\n');
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
  const publicCatalogue = publicCatalogueProjection(catalogue);
  const routes = allIndexableRoutes(catalogue);

  await rm(resolvedOutDir, { recursive: true, force: true });
  await mkdir(join(resolvedOutDir, 'server'), { recursive: true });
  await writeFile(join(resolvedOutDir, 'server/index.js'), `export default {\n  async fetch(request, env) {\n    return env.ASSETS.fetch(request);\n  }\n};\n`);

  const manifestRoutes = [];
  for (const route of routes) {
    const output = outputFileForPath(resolvedOutDir, route.path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, renderRoute(source, route, catalogue, publicCatalogue, routes, normalizedSiteUrl, formEndpoint));
    manifestRoutes.push({ path: route.path, output, kind: route.kind });
  }

  await Promise.all(STATIC_ASSETS.map(asset => cp(join(rootDir, asset), join(resolvedOutDir, asset), { recursive: true })));
  const sitemapUrls = manifestRoutes.map(route => absoluteUrl(normalizedSiteUrl, route.path));
  await Promise.all([
    writeFile(join(resolvedOutDir, 'sitemap.xml'), sitemapDocument(manifestRoutes, normalizedSiteUrl)),
    writeFile(join(resolvedOutDir, '_redirects'), redirectRules(catalogue)),
    writeFile(join(resolvedOutDir, '404.html'), notFoundDocument())
  ]);

  return { routes: manifestRoutes, sitemapUrls };
}
