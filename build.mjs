import { buildSite } from './build-lib.mjs';

const manifest = await buildSite({
  rootDir: process.cwd(),
  outDir: 'dist',
  siteUrl: 'https://beads.alwintru.com'
});

for (const route of manifest.routes) console.log(`${route.path} -> ${route.output}`);
console.log(`built ${manifest.routes.length} routes`);
