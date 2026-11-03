import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('multi-role assignment surface', () => {
  it('has no UI or API path that assigns an extra role via user_roles', () => {
    const srcDir = join(process.cwd(), 'src');
    const offenders: string[] = [];
    for (const file of walk(srcDir)) {
      if (file.endsWith('multiRoleAssignment.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      if (/user_roles|assign_user_role|grant_user_role/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
