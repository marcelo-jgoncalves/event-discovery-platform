#!/usr/bin/env node
// Runs every registered policy check under quality/policies/. First real
// policy landed in Phase 1 (Identity): the architecture fitness function
// that forbids importing services/identity/src/pii from outside
// services/identity (ADR-011 trigger: "when the first module's code
// exists"). Semgrep custom rules (EDP004) run inside CI's existing Semgrep
// job (.github/workflows/security.yml), not duplicated here.
import { checkNoExternalPiiImport } from '../policies/architecture/no-external-pii-import.mjs';
import { checkNoExternalProviderCall } from '../policies/architecture/no-external-provider-call.mjs';
import { checkWorkspaceScriptsDeclared } from '../policies/github/workspace-scripts-declared.mjs';

let failed = false;
let passed = 0;
const total = 3;

const piiViolations = checkNoExternalPiiImport(process.cwd());
if (piiViolations.length > 0) {
  failed = true;
  console.error('[quality-check] no-external-pii-import: VIOLATIONS FOUND');
  for (const v of piiViolations) {
    console.error(`  ${v.file} imports "${v.importSpecifier}"`);
  }
} else {
  passed += 1;
  console.log('[quality-check] no-external-pii-import: OK');
}

const providerViolations = checkNoExternalProviderCall(process.cwd());
if (providerViolations.length > 0) {
  failed = true;
  console.error('[quality-check] no-external-provider-call: VIOLATIONS FOUND');
  for (const v of providerViolations) {
    console.error(`  ${v.file} references provider host "${v.host}" outside its connector`);
  }
} else {
  passed += 1;
  console.log('[quality-check] no-external-provider-call: OK');
}

const scriptViolations = checkWorkspaceScriptsDeclared(process.cwd());
if (scriptViolations.length > 0) {
  failed = true;
  console.error('[quality-check] workspace-scripts-declared: VIOLATIONS FOUND');
  for (const v of scriptViolations) {
    console.error(`  ${v.workspace} is missing script(s): ${v.missing.join(', ')}`);
  }
} else {
  passed += 1;
  console.log('[quality-check] workspace-scripts-declared: OK');
}

if (failed) {
  process.exit(1);
}

console.log(`[quality-check] ${passed}/${total} registered policies passed.`);
process.exit(0);
