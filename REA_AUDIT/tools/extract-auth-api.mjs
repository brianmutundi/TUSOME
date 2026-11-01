import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
const needles = [
  'requestOtp', 'requestotp', 'otp', 'signin', 'signIn', 'sign-in', 'login', 'Login',
  'validateOtp', 'verifyOtp', 'verify', 'recover', 'resetPassword', 'changePassword',
  'auth/login', 'auth/signin', 'auth/sign-in', 'auth/otp', 'auth/verify',
];
const files = [
  'chunk-QSFK6GLI.js', 'chunk-LJBQHZUX.js', 'chunk-XT66RTGT.js', 'chunk-3GD56DBU.js',
  'chunk-EAWVGXTR.js', 'chunk-IJFMQNCN.js', 'chunk-7HIPCZWP.js', 'chunk-DUJEFOOK.js',
  'chunk-QOUSAK5H.js', 'chunk-4THGJPYR.js', 'chunk-XHRNTPMH.js', 'chunk-PFSMQ7TG.js',
  'chunk-KU7AVUK3.js', 'chunk-6YAHTK64.js', 'chunk-2RGCDPQF.js', 'chunk-OVTIWFFH.js',
  'chunk-DZTHJJJ3.js', 'chunk-QELWKASV.js', 'chunk-5XSH3TK4.js', 'chunk-PP5Q34DC.js',
  'chunk-7J2DVP7Z.js', 'chunk-ZMZCYM6K.js',
];
const out = [];
for (const file of files) {
  let text;
  try { text = readFileSync(join(SRC, file), 'utf8'); } catch { continue; }
  const hits = [];
  const seen = new Set();
  for (const needle of needles) {
    let idx = 0;
    while ((idx = text.indexOf(needle, idx)) !== -1) {
      const start = Math.max(0, idx - 120);
      const end = Math.min(text.length, idx + needle.length + 120);
      const slice = text.slice(start, end).replace(/\s+/g, ' ');
      if (!seen.has(slice)) { seen.add(slice); hits.push(`[${needle}] …${slice}…`); }
      idx += needle.length;
      if (hits.length > 120) break;
    }
    if (hits.length > 120) break;
  }
  if (hits.length) {
    out.push(`### ${file}`);
    out.push(...hits);
    out.push('');
  }
}
writeFileSync(join(OUT, 'auth_api_context.txt'), out.join('\n'), 'utf8');
console.log('context lines:', out.length);
