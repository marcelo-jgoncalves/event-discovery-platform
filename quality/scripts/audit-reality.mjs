#!/usr/bin/env node
// Reality audit (quality-enforcement-system.md §13): checks what's actually
// live via GitHub/AWS APIs, never trusting documentation or Terraform intent
// alone. Only checks things that exist today (ADR-010's two real resources)
// — grows as more infra is added, never lists a check it can't actually run.
import { execFileSync } from 'node:child_process';

const REPO = 'marcelo-jgoncalves/event-discovery-platform';
const ROLE_NAME = 'edp-dev-role-cicd-github-actions';
const AWS_PROFILE = process.env.AWS_PROFILE ?? 'claude-dev';

let failures = 0;

function check(name, fn) {
  try {
    const detail = fn();
    console.log(`[audit-reality] PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } catch (err) {
    failures += 1;
    console.error(`[audit-reality] FAIL  ${name} — ${err.message}`);
  }
}

check('branch protection enabled on main', () => {
  const out = execFileSync(
    'gh',
    ['api', `repos/${REPO}/branches/main/protection`, '--jq', '.enforce_admins.enabled'],
    { encoding: 'utf8' },
  ).trim();
  if (out !== 'true') throw new Error(`enforce_admins=${out}, expected true`);
  return 'enforce_admins=true';
});

check('IAM role for CI OIDC exists', () => {
  const out = execFileSync(
    'aws',
    [
      'iam',
      'get-role',
      '--role-name',
      ROLE_NAME,
      '--profile',
      AWS_PROFILE,
      '--query',
      'Role.Arn',
      '--output',
      'text',
    ],
    { encoding: 'utf8' },
  ).trim();
  if (!out.startsWith('arn:aws:iam::')) throw new Error(`unexpected output: ${out}`);
  return out;
});

if (failures > 0) {
  console.error(`\n[audit-reality] ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\n[audit-reality] all checks passed.');
