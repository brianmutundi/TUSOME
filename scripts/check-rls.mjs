import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Static RLS guard: every table created with a tenant_id column must, somewhere in
// the migrations, have RLS enabled and at least one tenant-checking policy.
// The live-DB counterpart is docs/rls-audit.csv (generated from pg_policies).

const root = process.cwd();
const migDir = join(root, 'supabase', 'migrations');

// Tables without tenant-scoped policies by design (must be justified here and in docs/rls-audit.csv).
const EXEMPT = new Map([
  ['permissions', 'Public read-only permission catalogue (no tenant data).'],
  ['report_share_tokens', 'Deny-all RLS; access only via token-gated SECURITY DEFINER RPC.'],
  ['document_share_tokens', 'Deny-all RLS; access only via token-gated SECURITY DEFINER RPC.'],
  ['receipt_share_tokens', 'Legacy token table dropped in 20261104000007 (unified into document_share_tokens); deny-all by design.'],
  ['statement_share_tokens', 'Legacy token table dropped in 20261104000007 (unified into document_share_tokens); deny-all by design.'],
]);

function extractParens(str, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') { depth--; if (depth === 0) return str.slice(startIdx + 1, i); }
  }
  return null;
}

const tenantTables = new Set();
const rlsEnabled = new Set();
const tenantPolicyTables = new Set();

for (const file of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  const text = readFileSync(join(migDir, file), 'utf8');

  for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)\s*\(/gi)) {
    const body = extractParens(text, m.index + m[0].length - 1) ?? '';
    if (/\btenant_id\b/i.test(body)) tenantTables.add(m[1]);
  }

  for (const m of text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?public\.([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security/gi)) {
    rlsEnabled.add(m[1]);
  }

  for (const m of text.matchAll(/create\s+policy\s+([a-zA-Z0-9_]+)\s+on\s+public\.([a-zA-Z0-9_]+)\s+([\s\S]*?);/gi)) {
    const stmt = m[3] ?? '';
    if (/\btenant_id\b|my_tenant_id\s*\(/i.test(stmt)) tenantPolicyTables.add(m[2]);
  }
}

const errors = [];
for (const table of [...tenantTables].sort()) {
  if (EXEMPT.has(table)) continue;
  if (!rlsEnabled.has(table)) errors.push(`${table}: tenant_id column but RLS never enabled in migrations`);
  if (!tenantPolicyTables.has(table)) errors.push(`${table}: tenant_id column but no tenant-checking policy in migrations`);
}

if (errors.length) {
  console.error('RLS tenant-guard failures:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`OK: ${tenantTables.size} tenant tables checked; ${EXEMPT.size} exempt; RLS + tenant policy present for the rest.`);
