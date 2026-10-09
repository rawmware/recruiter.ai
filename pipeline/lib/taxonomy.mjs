import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'taxonomy');

export function loadTaxonomy(dir = DIR) {
  const skills = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const { category, skills: list } = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const s of list) skills.push({ name: s.name, category, re: new RegExp(s.re, s.flags ?? 'i') });
  }
  return skills;
}

export const TAXONOMY = loadTaxonomy();

export function extractSkills(text, taxonomy = TAXONOMY) {
  return taxonomy.filter((s) => s.re.test(text)).map((s) => s.name);
}

export const categoryOf = Object.fromEntries(TAXONOMY.map((s) => [s.name, s.category]));
