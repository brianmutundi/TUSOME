import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const apiFile = join(process.cwd(), 'src', 'lib', 'analytics', 'api.ts');
const typesFile = join(process.cwd(), 'src', 'lib', 'analytics', 'types.ts');
const outputFile = join(process.cwd(), 'docs', 'API_REFERENCE.md');

const apiContent = readFileSync(apiFile, 'utf-8');
const typesContent = readFileSync(typesFile, 'utf-8');

// Extract function signatures
const funcRegex = /export (async )?function (\w+)\(([^)]*)\): Promise<([^>]+)>/g;
const functions = [];
let match;
while ((match = funcRegex.exec(apiContent)) !== null) {
  functions.push({
    name: match[2],
    params: match[3].trim(),
    returnType: match[4].trim(),
  });
}

// Extract type definitions
const typeRegex = /export interface (\w+) \{([^}]+)\}/g;
const types = [];
while ((match = typeRegex.exec(typesContent)) !== null) {
  types.push({
    name: match[1],
    fields: match[2].trim().split('\n').map((l) => l.trim()).filter(Boolean),
  });
}

// Generate markdown
let md = '# TUSOME Analytics API Reference\n\n';
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `Total functions: ${functions.length}\n`;
md += `Total types: ${types.length}\n\n`;

md += '## Functions\n\n';
md += '| Function | Parameters | Return Type |\n';
md += '|----------|-----------|-------------|\n';
for (const f of functions) {
  const params = f.params.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  md += `| \`${f.name}\` | ${params || 'none'} | ${f.returnType} |\n`;
}

md += '\n## Types\n\n';
for (const t of types) {
  md += `### ${t.name}\n\n`;
  md += '```typescript\n';
  md += `interface ${t.name} {\n`;
  for (const field of t.fields) {
    md += `  ${field}\n`;
  }
  md += '}\n';
  md += '```\n\n';
}

writeFileSync(outputFile, md);
console.log(`Generated ${outputFile} with ${functions.length} functions and ${types.length} types`);