import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
const files = readdirSync(SRC).filter((f) => f.endsWith('.js'));
const out = [];

for (const file of files) {
  const text = readFileSync(join(SRC, file), 'utf8');
  if (!/requestOtp|setNewPassword|verifyResetCode|signIn\(|login\(/.test(text)) continue;
  // Capture class method names near http calls
  const hits = new Set();
  for (const m of text.matchAll(/\.(post|get|put|patch|delete)\(([^)]{0,160})\)/g)) {
    const call = `${m[1].toUpperCase()} ${m[2].slice(0, 160)}`;
    if (/auth|otp|password|login|sign|verify|account|session|user|school|token/i.test(call)) hits.add(call);
  }
  for (const m of text.matchAll(/[A-Za-z0-9_$]+\s*\([^)]{0,80}\)\s*\{[^}]{0,120}(?:requestOtp|setNewPassword|verifyResetCode|recoverAccount|signIn)/g)) {
    hits.add(m[0].slice(0, 220));
  }
  if (hits.size) {
    out.push(`### ${file}`);
    out.push(...[...hits].slice(0, 80));
    out.push('');
  }
}
writeFileSync(join(OUT, 'auth_service_calls.txt'), out.join('\n'), 'utf8');
console.log('files:', out.filter((l) => l.startsWith('###')).length, 'lines:', out.length);
