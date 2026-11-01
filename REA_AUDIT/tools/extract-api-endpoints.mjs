import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
const files = readdirSync(SRC).filter((f) => f.endsWith('.js'));
const rows = new Set();

for (const file of files) {
  const text = readFileSync(join(SRC, file), 'utf8');
  // Template-literal URLs that reference an API base variable.
  for (const m of text.matchAll(/`\$\{[A-Za-z0-9_$.]+(?:ApiUrl|BaseUrl|baseUrl)\}([^`]*)`/g)) {
    const p = m[1].replace(/\$\{[^}]*\}/g, ':param');
    if (p.length < 2) continue;
    rows.add(`${p}\t${file}`);
  }
}
const sorted = [...rows].sort((a, b) => a.localeCompare(b));
writeFileSync(join(OUT, 'api_endpoints.tsv'), sorted.join('\n'), 'utf8');
console.log('endpoints:', sorted.length);
