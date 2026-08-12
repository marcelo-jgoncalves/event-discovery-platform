#!/usr/bin/env node
// Control Integrity Tests (quality-enforcement-system.md §6-7, §17): runs
// every registered control against its invalid/ fixture (must detect the
// violation) and its valid/ fixture (must not false-positive). A control
// without both proofs is a hypothesis, not a control — nothing is promoted
// to docs/engineering/quality-rules.md until this script proves it.
import { spawnSync } from 'node:child_process';
import { checkNoExternalPiiImport } from '../policies/architecture/no-external-pii-import.mjs';

let operational = 0;
let total = 0;
let anyFailure = false;

function report(name, ok, detail) {
  total += 1;
  if (ok) operational += 1;
  console.log(
    `[control-integrity] ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`,
  );
  if (!ok) anyFailure = true;
}

// --- Control: no-external-pii-import (architecture fitness function) ---
{
  const invalidViolations = checkNoExternalPiiImport(
    'quality/tests/fixtures/invalid/architecture/external-pii-import',
  );
  report(
    'no-external-pii-import rejects invalid fixture',
    invalidViolations.length > 0,
    `${invalidViolations.length} violation(s) found`,
  );

  const validViolations = checkNoExternalPiiImport(
    'quality/tests/fixtures/valid/architecture/external-pii-import',
  );
  report(
    'no-external-pii-import accepts valid fixture',
    validViolations.length === 0,
    `${validViolations.length} violation(s) found`,
  );
}

// --- Control: EDP004 (Semgrep — raw PII in logs) ---
{
  const semgrepBase = [
    'scan',
    '--config',
    'quality/policies/code/edp004-no-raw-pii-log.yaml',
    '--error',
    '--quiet',
  ];

  const invalid = spawnSync(
    'semgrep',
    [...semgrepBase, 'quality/tests/fixtures/invalid/code/edp004-raw-email-log.ts'],
    {
      encoding: 'utf8',
    },
  );
  if (invalid.error) {
    report(
      'EDP004 rejects invalid fixture',
      false,
      'semgrep not available locally — install to verify',
    );
  } else {
    report(
      'EDP004 rejects invalid fixture',
      invalid.status === 1,
      `semgrep exit code ${invalid.status}`,
    );
  }

  const valid = spawnSync(
    'semgrep',
    [...semgrepBase, 'quality/tests/fixtures/valid/code/edp004-hashed-email-log.ts'],
    {
      encoding: 'utf8',
    },
  );
  if (valid.error) {
    report(
      'EDP004 accepts valid fixture',
      false,
      'semgrep not available locally — install to verify',
    );
  } else {
    report('EDP004 accepts valid fixture', valid.status === 0, `semgrep exit code ${valid.status}`);
  }
}

console.log('');
console.log('Quality Control Integrity');
console.log('');
console.log(`${operational}/${total} controls operational`);
process.exit(anyFailure ? 1 : 0);
