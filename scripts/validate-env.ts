#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const repoRoot = path.resolve(process.cwd());
const schemaFile = path.join(repoRoot, 'backend/src/schemas/env.ts');
const backendExampleFile = path.join(repoRoot, 'backend/.env.example');
const frontendExampleFile = path.join(repoRoot, '.env.example');

function parseSchemaKeys(filePath: string): Map<string, { optional: boolean }> {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  const keys = new Map<string, { optional: boolean }>();

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (
        ts.isPropertyAccessExpression(expr) &&
        expr.name.text === 'object' &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'z'
      ) {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
          firstArg.properties.forEach((prop) => {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              const key = prop.name.text;
              const initText = prop.initializer.getText(sourceFile);
              const optional = /\.optional\(/.test(initText);
              keys.set(key, { optional });
            }
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return keys;
}

function parseEnvFile(filePath: string): Set<string> {
  const content = fs.readFileSync(filePath, 'utf8');
  const set = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z][A-Z0-9_]+)=/);
    if (match) {
      set.add(match[1]);
    }
  }
  return set;
}

const schemaKeys = parseSchemaKeys(schemaFile);
const backendExampleKeys = parseEnvFile(backendExampleFile);
const frontendExampleKeys = parseEnvFile(frontendExampleFile);

const missingInBackend: string[] = [];
const extraInBackend: string[] = [];

for (const [key, meta] of schemaKeys.entries()) {
  if (!meta.optional && !backendExampleKeys.has(key)) {
    missingInBackend.push(key);
  }
}

for (const key of backendExampleKeys) {
  if (!schemaKeys.has(key)) {
    extraInBackend.push(key);
  }
}

const sharedKeys = Array.from(schemaKeys.keys()).filter((key) =>
  key.startsWith('NEXT_PUBLIC_') || key === 'SUPABASE_SERVICE_ROLE_KEY' || key === 'PRIVY_APP_SECRET'
);
const missingInFrontend = sharedKeys.filter((key) => !frontendExampleKeys.has(key));

const problems: string[] = [];
if (missingInBackend.length) {
  problems.push(`Keys missing in backend/.env.example: ${missingInBackend.join(', ')}`);
}
if (extraInBackend.length) {
  problems.push(`Extra keys in backend/.env.example not covered by schema: ${extraInBackend.join(', ')}`);
}
if (missingInFrontend.length) {
  problems.push(`Shared keys missing in .env.example: ${missingInFrontend.join(', ')}`);
}

if (problems.length) {
  console.error('ENV schema mismatch detected:\n- ' + problems.join('\n- '));
  process.exit(1);
}

console.log('Environment templates match backend schema ✔');
