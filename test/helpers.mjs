import { readFile } from 'node:fs/promises';

export async function readCatalogue() {
  return JSON.parse(await readFile(new URL('../catalogue.json', import.meta.url), 'utf8'));
}
