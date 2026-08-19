#!/usr/bin/env node
// Orchestrator (quality-enforcement-system.md §25 "npm run audit:project"):
// runs every audit sub-component that exists today. Infra drift and
// provider contract drift aren't implemented yet — listed here as explicit
// skips, not silently omitted, so a reader of the output knows what wasn't
// checked (quality-strategy.md §12: "auditorias registram o que NÃO foi
// verificado, não só o que foi").
import { execFileSync } from 'node:child_process';

const steps = [
  ['GitHub + AWS reality', 'quality/scripts/audit-reality.mjs'],
  ['Quality control integrity', 'quality/scripts/quality-self-test.mjs'],
  ['Context consistency', 'quality/scripts/context-check.mjs'],
];

let failed = false;
for (const [label, script] of steps) {
  console.log(`\n=== ${label} ===`);
  try {
    execFileSync('node', [script], { stdio: 'inherit' });
  } catch {
    failed = true;
  }
}

console.log('\n=== Not implemented yet (see docs/backlog.md) ===');
console.log('- infra drift (terraform plan -detailed-exitcode)');
console.log('- provider contract drift (TMDB/Ticketmaster canaries)');

process.exit(failed ? 1 : 0);
