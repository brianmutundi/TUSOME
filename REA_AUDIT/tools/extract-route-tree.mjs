import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
const ROOT = 'main-WD43ENPP.js';

const files = new Set(readdirSync(SRC).filter((f) => f.endsWith('.js')));
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, readFileSync(join(SRC, file), 'utf8'));
  return cache.get(file);
}

/**
 * Pull every lazy route entry out of a chunk:
 *   path:"x" ... loadChildren/loadComponent:()=>import("./chunk-Y.js")
 * The compiled Angular config is regular enough that the nearest preceding
 * path/`data` before an import call identifies the route.
 */
function edgesOf(file) {
  const text = read(file);
  const edges = [];
  const re = /load(Children|Component):\(\)=>import\("\.\/([A-Za-z0-9_-]+\.js)"\)\.then\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(0, m.index);
    const pathIdx = before.lastIndexOf('path:"');
    if (pathIdx === -1) continue;
    // Reject if the path belongs to an unrelated, already-closed route object.
    const between = before.slice(pathIdx, m.index);
    if (/load(Children|Component):/.test(between)) continue;
    const pathEnd = before.indexOf('"', pathIdx + 6);
    const path = before.slice(pathIdx + 6, pathEnd);
    const prefix = before.slice(pathIdx, m.index);
    const dataIdx = prefix.lastIndexOf('data:{');
    let permission = '';
    let permissions = '';
    let allowRoles = '';
    if (dataIdx !== -1) {
      const dataText = prefix.slice(dataIdx);
      const p = dataText.match(/permission:"([^"]+)"/);
      const ps = dataText.match(/permissions:\[([^\]]*)\]/);
      const ar = dataText.match(/allowRoles:\[([^\]]*)\]/);
      if (p) permission = p[1];
      if (ps) permissions = [...ps[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).join(',');
      if (ar) allowRoles = [...ar[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).join(',');
    }
    edges.push({ parent: file, path, child: m[2], permission, permissions, allowRoles, kind: m[1] });
  }
  return edges;
}

const edgesByParent = new Map();
for (const file of files) {
  const edges = edgesOf(file);
  if (edges.length) edgesByParent.set(file, edges);
}

// DFS from the root route table, composing full paths.
const rows = [];
const seen = new Set();
function walk(file, base, depth) {
  if (depth > 8) return;
  const edges = edgesByParent.get(file) ?? [];
  for (const edge of edges) {
    const seg = edge.path.startsWith('/') ? edge.path : `${base}/${edge.path}`;
    const full = seg.replace(/\/+/g, '/');
    const key = `${full}\t${edge.child}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ full, ...edge });
    if (edge.kind === 'Children') walk(edge.child, full, depth + 1);
  }
}

walk(ROOT, '', 0);
// Some feature chunks are loaded from modules without a parent edge (e.g.
// legacy tree); capture their in-chunk route entries too so nothing is lost.
for (const [file, edges] of edgesByParent) {
  if (file === ROOT) continue;
  if (rows.some((r) => r.child === file || r.parent === file)) continue;
  for (const edge of edges) {
    const full = `/${edge.path}`;
    if (rows.some((r) => r.full === full && r.child === edge.child)) continue;
    rows.push({ full: `${full} [orphan:${file.replace('.js', '')}]`, ...edge });
  }
}

rows.sort((a, b) => a.full.localeCompare(b.full));
const tsv = [
  'full_path\tpath\tchunk\tparent_chunk\tkind\tpermission\tpermissions\tallow_roles',
  ...rows.map((r) =>
    [r.full, r.path, r.child, r.parent, r.kind, r.permission, r.permissions, r.allowRoles].join('\t')
  ),
].join('\n');
writeFileSync(join(OUT, 'route_tree.tsv'), tsv, 'utf8');
console.log('routes:', rows.length);
console.log('chunks with child routes:', edgesByParent.size);
console.log('top-level modules:', rows.filter((r) => r.full.split('/').length === 2).length);
