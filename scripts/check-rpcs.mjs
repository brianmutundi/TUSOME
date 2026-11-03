import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const srcDir = join(root, 'src');
const migDir = join(root, 'supabase', 'migrations');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// 1. Extract RPC calls: name + param keys
const used = new Map(); // name -> Set of param keys
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8');
  // named-arg form: .rpc('name', { p_foo: ..., p_bar: ... })
  for (const m of text.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*\{([^}]*)\}/g)) {
    const name = m[1];
    const body = m[2];
    const keys = new Set();
    for (const km of body.matchAll(/([a-zA-Z0-9_]+)\s*:/g)) {
      keys.add(km[1]);
    }
    if (!used.has(name)) used.set(name, new Set());
    for (const k of keys) used.get(name).add(k);
  }
  // positional/empty form: .rpc('name') or .rpc('name', { signal })
  for (const m of text.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) {
    const name = m[1];
    if (!used.has(name)) used.set(name, new Set());
  }
}

// 2. Extract function definitions: name + param names
const defined = new Map(); // name -> Set of param names
for (const file of readdirSync(migDir)) {
  if (!file.endsWith('.sql')) continue;
  const text = readFileSync(join(migDir, file), 'utf8');
  // Match CREATE OR REPLACE FUNCTION public.name(param1 type, param2 type DEFAULT ...)
  for (const m of text.matchAll(/function\s+public\.([a-zA-Z0-9_]+)\s*\(([^)]*)\)/gi)) {
    const name = m[1];
    const params = m[2].trim();
    const keys = new Set();
    if (params && params !== '') {
      // split by comma, but be careful with nested types
      for (const part of params.split(',')) {
        const pm = part.trim().match(/^([a-zA-Z0-9_]+)\s/);
        if (pm) keys.add(pm[1]);
      }
    }
    if (!defined.has(name)) defined.set(name, new Set());
    for (const k of keys) defined.get(name).add(k);
  }
}

// 3. Compare
let errors = 0;
const missing = [...used.keys()].filter((n) => !defined.has(n)).sort();
if (missing.length) {
  console.error('Missing RPCs in migrations:', missing.join(', '));
  errors++;
}

// Check param names for functions that have both
for (const [name, usedKeys] of used) {
  if (usedKeys.size === 0) continue; // no named args in calls
  const defKeys = defined.get(name);
  if (!defKeys) continue; // already reported as missing
  const unknown = [...usedKeys].filter((k) => !defKeys.has(k) && k !== 'signal');
  if (unknown.length) {
    console.error(`Unknown params for ${name}: ${unknown.join(', ')} (defined: ${[...defKeys].join(', ')})`);
    errors++;
  }
}

if (errors > 0) {
  process.exit(1);
}
console.log(`OK: ${used.size} RPCs used, all defined. Param names checked for ${[...used.values()].filter(s => s.size > 0).length} calls.`);