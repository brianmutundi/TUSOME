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

// Extract balanced paren content starting at index of '('
function extractParams(str, startIdx) {
  // str[startIdx] should be '('
  let depth = 0;
  let i = startIdx;
  while (i < str.length) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') { depth--; if (depth === 0) return str.slice(startIdx + 1, i); }
    i++;
  }
  return null;
}

// 1. Extract RPC calls: name + param keys
const used = new Map();
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*\{([^}]*)\}/g)) {
    const name = m[1];
    const body = m[2];
    const keys = new Set();
    for (const km of body.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) keys.add(km[1]);
    if (!used.has(name)) used.set(name, new Set());
    for (const k of keys) used.get(name).add(k);
  }
  for (const m of text.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)) {
    const name = m[1];
    if (!used.has(name)) used.set(name, new Set());
  }
}

// 2. Extract function definitions: name + param names (balanced parens)
const defined = new Map();
for (const file of readdirSync(migDir)) {
  if (!file.endsWith('.sql')) continue;
  const text = readFileSync(join(migDir, file), 'utf8');
  // Find all "function public.NAME(" occurrences
  const re = /function\s+public\.([a-zA-Z0-9_]+)\s*\(/gi;
  for (const m of text.matchAll(re)) {
    const name = m[1];
    const idx = m.index + m[0].length - 1; // position of '('
    const paramsStr = extractParams(text, idx);
    if (paramsStr === null) continue;
    const keys = new Set();
    if (paramsStr.trim() !== '') {
      // Split by top-level commas
      let depth = 0, cur = '';
      const parts = [];
      for (const ch of paramsStr) {
        if (ch === '(') { depth++; cur += ch; }
        else if (ch === ')') { depth--; cur += ch; }
        else if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
        else cur += ch;
      }
      if (cur.trim()) parts.push(cur);
      for (const part of parts) {
        const pm = part.trim().match(/^([a-zA-Z0-9_]+)\s/);
        if (pm) keys.add(pm[1]);
      }
    }
    if (!defined.has(name)) defined.set(name, new Set());
    // merge (keep union across redefinitions)
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

for (const [name, usedKeys] of used) {
  if (usedKeys.size === 0) continue;
  const defKeys = defined.get(name);
  if (!defKeys) continue;
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
