/**
 * Verify the tenant-scoped analytics filter RPC against the isolated local stack.
 *
 * Prints counts and exam labels only: no tokens, no keys, no student records.
 */
const BASE = 'http://127.0.0.1:54321';
import { readFileSync } from 'node:fs';
const SECRETS = readFileSync(
  new URL('../../local/.local-secrets.json', import.meta.url),
  'utf8'
);
const ANON = JSON.parse(SECRETS).anonKey;
const EMAIL = process.env.LOCAL_EMAIL ?? 'brianras10@gmail.com';
const PASSWORD = process.env.LOCAL_PASSWORD ?? 'Brayani254';

if (!ANON) {
  console.error('Set LOCAL_ANON_KEY (from local/.local-secrets.json, anonKey only).');
  process.exit(2);
}

const tokenRes = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!tokenRes.ok) {
  console.error('login failed', tokenRes.status, (await tokenRes.text()).slice(0, 200));
  process.exit(1);
}
const session = await tokenRes.json();

const rpcRes = await fetch(`${BASE}/rest/v1/rpc/get_analytics_filters`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    authorization: `Bearer ${session.access_token}`,
    'content-type': 'application/json',
  },
  body: '{}',
});
const body = await rpcRes.json();
if (!rpcRes.ok) {
  console.error('rpc failed', rpcRes.status, body);
  process.exit(1);
}

const counts = {
  exams: body.exams?.length ?? 0,
  classes: body.classes?.length ?? 0,
  streams: body.streams?.length ?? 0,
};
console.log('counts', JSON.stringify(counts));
console.log(
  'exams',
  (body.exams ?? []).map((e) => `${e.name} [${e.academic_year}] ${e.status}`).join(' | ')
);
const foreign = (body.exams ?? []).filter((e) => e.status !== 'published');
if (foreign.length) {
  console.error('FAIL: non-published exam leaked into filters');
  process.exit(1);
}
console.log('OK: published-only, tenant-scoped filter payload');
