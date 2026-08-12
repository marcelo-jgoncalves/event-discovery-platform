#!/usr/bin/env node
// Runs every registered policy check under quality/policies/. First real
// policy landed in Phase 1 (Identity): the architecture fitness function
// that forbids importing services/identity/src/pii from outside
// services/identity (ADR-011 trigger: "when the first module's code
// exists"). Semgrep custom rules (EDP004) run inside CI's existing Semgrep
// job (.github/workflows/security.yml), not duplicated here.
import { checkNoExternalPiiImport } from '../policies/architecture/no-external-pii-import.mjs';

let failed = false;

const violations = checkNoExternalPiiImport(process.cwd());
if (violations.length > 0) {
  failed = true;
  console.error('[quality-check] no-external-pii-import: VIOLATIONS FOUND');
  for (const v of violations) {
    console.error(`  ${v.file} imports "${v.importSpecifier}"`);
  }
} else {
  console.log('[quality-check] no-external-pii-import: OK');
}

if (failed) {
  process.exit(1);
}

console.log('[quality-check] 1/1 registered policy passed.');
process.exit(0);
