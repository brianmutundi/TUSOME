import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';

function readTsv(name) {
  const text = readFileSync(join(OUT, name), 'utf8');
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

const routes = readTsv('angular_routes.tsv'); // path \t file (maybe more cols)
const perms = readTsv('route_permissions.tsv'); // path \t file \t permission \t allowRoles
const endpoints = readTsv('api_endpoints.tsv'); // endpoint \t file

function moduleOf(path) {
  const clean = path.replace(/^\/+/, '');
  const seg = clean.split('/')[0] || '(root)';
  return seg;
}

const modules = new Map();

function ensure(name) {
  if (!modules.has(name)) {
    modules.set(name, { routes: new Set(), permissions: new Set(), roles: new Set(), endpoints: new Set() });
  }
  return modules.get(name);
}

for (const row of routes) {
  const path = row[0];
  if (!path) continue;
  ensure(moduleOf(path)).routes.add(path);
}
for (const row of perms) {
  const path = row[0];
  if (!path) continue;
  const m = ensure(moduleOf(path));
  if (row[2]) for (const p of row[2].split(',')) if (p) m.permissions.add(p);
  if (row[3]) for (const p of row[3].split(',')) if (p) m.roles.add(p);
}
for (const row of endpoints) {
  const path = row[0];
  if (!path) continue;
  const first = path.replace(/^\/+/, '').split('/')[0] || '(root)';
  ensure(first).endpoints.add(path);
}

const rows = [];
for (const [name, m] of [...modules].sort((a, b) => a[0].localeCompare(b[0]))) {
  rows.push(
    [
      name,
      m.routes.size,
      m.endpoints.size,
      m.permissions.size,
      [...m.permissions].sort().join(','),
      [...m.roles].sort().join(','),
    ].join('\t')
  );
}
writeFileSync(join(OUT, 'module_summary.tsv'), ['module\troutes\tendpoints\tpermissions\tpermission_list\tallow_roles', ...rows].join('\n'), 'utf8');
console.log(rows.join('\n'));
console.log('\nmodules:', rows.length);
