#!/usr/bin/env node
// Runs every registered policy check under quality/policies/. First real
// policy landed in Phase 1 (Identity): the architecture fitness function
// that forbids importing services/identity/src/pii from outside
// services/identity (ADR-011 trigger: "when the first module's code
// exists"). Semgrep custom rules (EDP004) run inside CI's existing Semgrep
// job (.github/workflows/security.yml), not duplicated here.
import { checkNoExternalPiiImport } from '../policies/architecture/no-external-pii-import.mjs';
import { checkNoExternalProviderCall } from '../policies/architecture/no-external-provider-call.mjs';
import { checkIamActionCoverage } from '../policies/architecture/iam-action-coverage.mjs';
import { checkWorkspaceScriptsDeclared } from '../policies/github/workspace-scripts-declared.mjs';

let failed = false;
let passed = 0;
const total = 4;

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

const iamViolations = checkIamActionCoverage(process.cwd());
if (iamViolations.length > 0) {
  failed = true;
  console.error('[quality-check] iam-action-coverage: VIOLATIONS FOUND');
  for (const v of iamViolations) {
    console.error(
      `  services/${v.service} calls an SDK command requiring "${v.action}", not granted in infrastructure/terraform/modules/${v.service}/`,
    );
  }
} else {
  passed += 1;
  console.log('[quality-check] iam-action-coverage: OK');
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
