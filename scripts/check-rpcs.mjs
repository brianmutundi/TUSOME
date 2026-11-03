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

const used = new Set();
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
    used.add(m[1]);
  }
}

const defined = new Set();
for (const file of readdirSync(migDir)) {
  if (!file.endsWith('.sql')) continue;
  const text = readFileSync(join(migDir, file), 'utf8');
  for (const m of text.matchAll(/function\s+public\.([a-zA-Z0-9_]+)/gi)) {
    defined.add(m[1]);
  }
}

const missing = [...used].filter((n) => !defined.has(n)).sort();
if (missing.length) {
  console.error('Missing RPCs in migrations:', missing.join(', '));
  process.exit(1);
}
console.log(`OK: ${used.size} RPCs used, all defined in migrations.`);