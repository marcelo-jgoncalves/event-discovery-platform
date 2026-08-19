#!/usr/bin/env node
// Architecture/process fitness function: `npm run <script> --workspaces
// --if-present` in scripts/run-workspaces.mjs silently skips any workspace
// whose package.json omits the script — a new workspace could ship product
// code with no "test"/"lint"/"typecheck" script and CI would stay green
// with 0 tests run for it instead of failing. This check makes that
// impossible: every workspace with a package.json must declare all three
// required scripts, or this fails loud in the same `quality:check` gate
// that `verify` already ran before it.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE_ROOTS = ['apps', 'services', 'connectors', 'packages'];
const REQUIRED_SCRIPTS = ['typecheck', 'lint', 'test'];

export function checkWorkspaceScriptsDeclared(rootDir) {
  const violations = [];

  for (const root of WORKSPACE_ROOTS) {
    const dir = join(rootDir, root);
    if (!existsSync(dir)) continue;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(dir, entry.name, 'package.json');
      if (!existsSync(pkgPath)) continue; // not a real workspace yet (placeholder dir)

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts ?? {};
      const missing = REQUIRED_SCRIPTS.filter((name) => typeof scripts[name] !== 'string');
      if (missing.length > 0) {
        violations.push({ workspace: `${root}/${entry.name}`, missing });
      }
    }
  }

  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.argv[2] ?? process.cwd();
  const violations = checkWorkspaceScriptsDeclared(rootDir);
  if (violations.length > 0) {
    console.error('[fitness-function] workspace-scripts-declared: VIOLATIONS FOUND');
    for (const v of violations) {
      console.error(`  ${v.workspace} is missing script(s): ${v.missing.join(', ')}`);
    }
    process.exit(1);
  }
  console.log('[fitness-function] workspace-scripts-declared: OK — 0 violations.');
  process.exit(0);
}
