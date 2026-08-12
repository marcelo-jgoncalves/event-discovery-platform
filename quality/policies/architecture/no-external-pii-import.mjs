#!/usr/bin/env node
// Architecture Fitness Function (ADR-011 §"Architecture Fitness Functions";
// quality-enforcement-system.md §8 "matcher does not import PII", first
// concrete implementation now that services/identity exists — ADR-011's
// trigger condition for this).
//
// Rule: no module outside services/identity may import
// services/identity/src/pii/* — that directory is the only place in the
// monorepo allowed to touch raw user PII (spec-identity.md §8, ADR-012).
//
// Scans source text for the forbidden import specifier rather than doing
// full module resolution — cheap, dependency-free, and sufficient: any
// import path segment matching /identity\/(src\/)?pii(\/|$)/ or the package
// form (@edp/identity/pii) is a violation regardless of relative vs.
// absolute path.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORBIDDEN_IMPORT_PATTERN = /from\s+['"]([^'"]*identity\/(?:src\/)?pii[^'"]*)['"]/g;
const SCAN_ROOTS = ['apps', 'services', 'connectors', 'packages'];
const ALLOWED_PREFIX = join('services', 'identity');

function listSourceFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

export function checkNoExternalPiiImport(rootDir) {
  const violations = [];

  for (const root of SCAN_ROOTS) {
    const dir = join(rootDir, root);
    let exists = true;
    try {
      statSync(dir);
    } catch {
      exists = false;
    }
    if (!exists) continue;

    for (const file of listSourceFiles(dir)) {
      const relPath = relative(rootDir, file);
      const isInsideIdentity = relPath.startsWith(ALLOWED_PREFIX + sep);
      if (isInsideIdentity) continue;

      const content = readFileSync(file, 'utf8');
      let match;
      FORBIDDEN_IMPORT_PATTERN.lastIndex = 0;
      while ((match = FORBIDDEN_IMPORT_PATTERN.exec(content)) !== null) {
        violations.push({ file: relPath, importSpecifier: match[1] });
      }
    }
  }

  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.argv[2] ?? process.cwd();
  const violations = checkNoExternalPiiImport(rootDir);
  if (violations.length > 0) {
    console.error('[fitness-function] no-external-pii-import: VIOLATIONS FOUND');
    for (const v of violations) {
      console.error(`  ${v.file} imports "${v.importSpecifier}"`);
    }
    process.exit(1);
  }
  console.log('[fitness-function] no-external-pii-import: OK — 0 violations.');
  process.exit(0);
}
