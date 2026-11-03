import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'C:/Users/brian/AppData/Local/Temp/zeraki/base/assets/public';
const OUT = 'C:/Users/brian/Videos/TUSOME/REA_AUDIT/evidence';
const files = [
  'chunk-QSFK6GLI.js',
  'chunk-LJBQHZUX.js',
  'chunk-XT66RTGT.js',
  'chunk-3GD56DBU.js',
  'chunk-EAWVGXTR.js',
  'chunk-IJFMQNCN.js',
  'chunk-7HIPCZWP.js',
  'chunk-DUJEFOOK.js',
  'chunk-QOUSAK5H.js',
  'chunk-4THGJPYR.js',
  'chunk-XHRNTPMH.js',
  'chunk-PFSMQ7TG.js',
  'chunk-KU7AVUK3.js',
  'chunk-6YAHTK64.js',
  'chunk-2RGCDPQF.js',
  'chunk-OVTIWFFH.js',
  'chunk-DZTHJJJ3.js',
  'chunk-QELWKASV.js',
  'chunk-5XSH3TK4.js',
  'chunk-PP5Q34DC.js',
];

const lines = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(join(SRC, file), 'utf8');
  } catch {
    continue;
  }
  const strings = new Set();
  // Any quoted string that looks like an endpoint, path or request field.
  for (const m of text.matchAll(/[`"']([^`"']{3,120})[`"']/g)) {
    const s = m[1];
    if (/^\/[a-z0-9_/:.-]+$/i.test(s) && !s.startsWith('//')) strings.add(s);
  }
  // Highlight auth verbs/field names for manual review.
  const keywords = new Set();
  for (const m of text.matchAll(/[`"']([A-Za-z][A-Za-z0-9_]{2,40})[`"']/g)) {
    const s = m[1];
    if (/otp|phone|email|password|username|verify|recover|reset|account|session|token|biometric|pin|school/i.test(s)) {
      keywords.add(s);
    }
  }
  lines.push(`### ${file}`);
  lines.push(`endpoints: ${[...strings].sort().join(' | ')}`);
  lines.push(`keywords: ${[...keywords].sort().join(' | ')}`);
  lines.push('');
}
writeFileSync(join(OUT, 'auth_flow_strings.txt'), lines.join('\n'), 'utf8');
console.log('wrote auth_flow_strings.txt', lines.length);
