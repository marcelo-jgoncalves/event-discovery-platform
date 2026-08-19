#!/usr/bin/env node
// Runs `npm run <script> --workspaces --if-present`, but `npm ... --workspaces`
// hard-fails with "No workspaces found!" when zero workspace folders exist
// yet. Gates must exist and run from commit zero even with nothing to check
// (docs/operations/phase-0-kickoff-prompt.md §4) rather than being added
// later once code shows up unguarded — this wrapper makes that true without
// weakening the gate once the first workspace lands. As of Phase 1-2,
// services/identity, services/catalog, connectors/tmdb,
// connectors/ticketmaster and packages/provider-contracts are real
// workspaces; apps/, packages/config|contracts|domain|observability|testing
// and services/ingestion|matching|notifications|tracking are still empty
// placeholders for later phases.
//
// `--if-present` also means a workspace whose package.json omits a required
// script (e.g. no "test") is silently skipped for that script instead of
// failing the gate — quality/scripts/quality-check.mjs's
// workspace-scripts-declared check (added in the engineering-quality
// review, 2026-08-19) closes that gap by asserting every real workspace
// declares typecheck/lint/test.
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const scriptName = process.argv[2];
if (!scriptName) {
  console.error('Usage: run-workspaces.mjs <npm-script-name>');
  process.exit(1);
}

const workspaceGlobs = ['apps', 'services', 'connectors', 'packages'];

function hasAnyWorkspace() {
  return workspaceGlobs.some((dir) => {
    if (!existsSync(dir)) return false;
    return readdirSync(dir, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && existsSync(`${dir}/${entry.name}/package.json`),
    );
  });
}

if (!hasAnyWorkspace()) {
  console.log(`[run-workspaces] no workspaces yet — "${scriptName}": 0 to run, treated as pass.`);
  process.exit(0);
}

const result = spawnSync('npm', ['run', scriptName, '--workspaces', '--if-present'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
