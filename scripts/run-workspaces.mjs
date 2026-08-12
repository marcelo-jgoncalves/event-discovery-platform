#!/usr/bin/env node
// Runs `npm run <script> --workspaces --if-present`, but `npm ... --workspaces`
// hard-fails with "No workspaces found!" when zero workspace folders exist yet
// (this project's current bootstrap state: apps/services/connectors/packages
// are empty). Gates must exist and run from commit zero even with nothing to
// check (docs/operations/phase-0-kickoff-prompt.md §4) rather than being
// added later once code shows up unguarded — this wrapper makes that true
// without weakening the gate once the first workspace lands.
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
