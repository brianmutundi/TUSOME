import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
mkdirSync(OUT, { recursive: true });

const rolesFile = readFileSync(join(SRC, 'chunk-4ELYURC5.js'), 'utf8');

// Role enum: (s=>(s.X="Y",...))
const enumMatch = rolesFile.match(/\(s=>\(([^)]*)\)\)\(/);
const roleEnum = enumMatch ? [...enumMatch[1].matchAll(/s\.([A-Z_]+)="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`) : [];

// Permission getters
const perms = [...rolesFile.matchAll(/get\s+([A-Za-z0-9_]+)\(\)\s*\{\s*return\s+this\.hasPermission\("([^"]+)"\)/g)].map(
  (m) => `${m[1]}\t${m[2]}`
);

// Role getters
const roleGetters = [...rolesFile.matchAll(/get\s+([A-Za-z0-9_]+)\(\)\s*\{\s*return\s+this\.roleValue\?\.roles\?\.includes\("([^"]+)"\)/g)].map(
  (m) => `${m[1]}\t${m[2]}`
);

writeFileSync(join(OUT, 'role_enum.txt'), roleEnum.join('\n'), 'utf8');
writeFileSync(join(OUT, 'permission_getters.tsv'), perms.join('\n'), 'utf8');
writeFileSync(join(OUT, 'role_getters.tsv'), roleGetters.join('\n'), 'utf8');

console.log('roles:', roleEnum.length, roleEnum.join(', '));
console.log('permission getters:', perms.length);
console.log('role getters:', roleGetters.length);

// All permission literals used in route data across the app
const all = new Set();
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.js'))) {
  const text = readFileSync(join(SRC, f), 'utf8');
  for (const m of text.matchAll(/permission(?:s)?\s*:\s*(\[[^\]]*\]|"[^"]+")/g)) {
    const raw = m[1];
    for (const p of raw.matchAll(/"([^"]+)"/g)) all.add(p[1]);
  }
}
writeFileSync(join(OUT, 'permission_literals.txt'), [...all].sort().join('\n'), 'utf8');
console.log('permission literals:', all.size);
