import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith('.js'));
const rows = [];
const seen = new Set();

for (const file of files) {
  const text = readFileSync(join(SRC, file), 'utf8');
  const re = /path:\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const path = m[1];
    // Window from this path to the next path declaration (max 1200 chars).
    const start = m.index;
    const nextIdx = text.indexOf('path:', start + 10);
    const end = Math.min(nextIdx === -1 ? text.length : nextIdx, start + 1400);
    const window = text.slice(start, end);

    const perms = new Set();
    for (const pm of window.matchAll(/permissions?\s*:\s*(\[[^\]]*\]|"[^"]*")/g)) {
      for (const p of pm[1].matchAll(/"([^"]+)"/g)) perms.add(p[1]);
    }
    const allow = new Set();
    for (const am of window.matchAll(/allowRoles\s*:\s*(\[[^\]]*\])/g)) {
      for (const p of am[1].matchAll(/"([^"]+)"/g)) allow.add(p[1]);
    }
    const key = `${path}\t${file}\t${[...perms].sort().join(',')}\t${[...allow].sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(key);
  }
}

rows.sort((a, b) => a.localeCompare(b));
writeFileSync(join(OUT, 'route_permissions.tsv'), rows.join('\n'), 'utf8');
console.log('rows:', rows.length);
const withPerm = rows.filter((r) => r.split('\t')[2]).length;
const withRoles = rows.filter((r) => r.split('\t')[3]).length;
console.log('with permission:', withPerm, 'with allowRoles:', withRoles);
