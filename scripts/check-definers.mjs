import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migDir = join(root, 'supabase', 'migrations');

// Functions that are SECURITY DEFINER by design but do not carry a tenant/permission
// guard in their body. Each entry must be justified; adding a new one requires review.
const EXEMPT = new Set([
  'assert_parent_of',            // guard helper itself
  'custom_access_token_hook',    // JWT hook; no tenant context yet
  'get_my_child_attendance',     // uses assert_parent_of (parent link) instead of tenant
  'get_my_child_fees',
  'get_my_child_payments',
  'get_my_child_results',
  'get_shared_report',           // token-gated public report
  'is_admin',                   // helper
  'is_parent',                  // helper
  'log_audit_event',            // internal logging
  'log_sensitive_field_access',  // internal logging
  'my_tenant_id',               // helper
  'next_receipt_number',         // internal counter
  'rls_auto_enable',            // trigger helper
  'set_my_phone',               // self-service (auth.uid() scoped)
  'teacher_has_allocation',      // guard helper
  'fee_period_for_date',         // pure period resolver; callers enforce tenant + permission before use
  'get_document_by_token',        // token-gated public document read (document_share_tokens hash lookup)
  'get_fee_statement_by_token',  // token-gated public statement rows read (unified document_share_tokens)
  'get_receipt_by_token',         // token-gated public receipt read (document_share_tokens hash lookup)
  'get_statement_by_token',      // token-gated public statement read (legacy token table, unified)
]);

const GUARD_PATTERNS = [
  /my_tenant_id\s*\(/,
  /normalize_role_key\s*\(/,
  /user_has_permission\s*\(/,
  /is_parent\s*\(/,
  /assert_parent_of\s*\(/,
  /teacher_has_allocation\s*\(/,
  // Homework write RPCs delegate to one guard that checks tenant claim, manage-homework and allocation.
  /homework_assert_staff\s*\(/,
  // Message inbox RPCs delegate to one guard that checks tenant claim, reply-parent-messages and who may see the thread.
  /parent_msg_assert_staff\s*\(/,
  // Tenant resolved from the caller's JWT claims inside the function body.
  /v_caller_tenant\s*:=/,
  /auth\.jwt\(\)\s*->>\s*'tenant_id'/,
  // Tenant resolved from an explicit, caller-validated tenant argument.
  /p_tenant_id/,
];

const files = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();

const definers = new Map(); // name -> { file, hasGuard, exempt }

for (const file of files) {
  const text = readFileSync(join(migDir, file), 'utf8');
  // Match CREATE [OR REPLACE] FUNCTION public.name(...) ... AS $tag$ body $tag$
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*([\s\S]*?)AS\s+(\$\w*\$)([\s\S]*?)\4/gi;
  for (const m of text.matchAll(re)) {
    const name = m[1];
    const prelude = m[3] || '';
    const body = m[5] || '';
    const full = `${prelude}\n${body}`;
    const isDefiner = /SECURITY\s+DEFINER/i.test(full);
    if (!isDefiner) continue;
    const hasGuard = GUARD_PATTERNS.some(p => p.test(full));
    const exempt = EXEMPT.has(name);
    // keep last definition (latest migration wins)
    definers.set(name, { file, hasGuard, exempt });
  }
}

let errors = 0;
const unguarded = [];
for (const [name, info] of [...definers.entries()].sort()) {
  if (info.exempt) continue;
  if (!info.hasGuard) {
    unguarded.push(name);
    errors++;
  }
}

if (unguarded.length) {
  console.error('SECURITY DEFINER functions without tenant/permission guard:');
  for (const n of unguarded) console.error('  - ' + n);
  console.error('\nEither add a guard (my_tenant_id/normalize_role_key/user_has_permission/is_parent/assert_parent_of/teacher_has_allocation) or add to EXEMPT with justification.');
  process.exit(1);
}
console.log(`OK: ${definers.size} SECURITY DEFINER functions checked; ${EXEMPT.size} exempt; all others guarded.`);
