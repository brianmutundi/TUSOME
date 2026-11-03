import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith('.js'));
const routes = new Map();
const apis = new Map();
const lazy = new Map();

for (const file of files) {
  const text = readFileSync(join(SRC, file), 'utf8');

  for (const match of text.matchAll(/path:\s*"([^"]{0,120})"/g)) {
    const p = match[1];
    if (!routes.has(p)) routes.set(p, new Set());
    routes.get(p).add(file);
  }
  for (const match of text.matchAll(/loadComponent:\s*\(\)\s*=>\s*import\("\.\/([^"]+)"\)/g)) {
    lazy.set(match[1], file);
  }
  // Backend relative endpoint paths used in HttpClient calls.
  for (const match of text.matchAll(/[`"'](\/(?:api\/)?[a-z][a-z0-9_/-]{2,80})[`"']/g)) {
    const p = match[1];
    if (p.includes('assets/') || p.endsWith('.svg') || p.endsWith('.png') || p.endsWith('.json')) continue;
    if (!apis.has(p)) apis.set(p, new Set());
    apis.get(p).add(file);
  }
}

const routeRows = [...routes.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([p, fs]) => `${p}\t${[...fs].join(',')}`);
writeFileSync(join(OUT, 'angular_routes.tsv'), routeRows.join('\n'), 'utf8');

const apiRows = [...apis.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([p, fs]) => `${p}\t${[...fs].join(',')}`);
writeFileSync(join(OUT, 'candidate_paths.tsv'), apiRows.join('\n'), 'utf8');

console.log('js files:', files.length);
console.log('route paths:', routes.size);
console.log('candidate endpoint strings:', apis.size);
console.log('lazy chunks:', lazy.size);
console.log('wrote', OUT);
