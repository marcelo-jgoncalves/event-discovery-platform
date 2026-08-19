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

// PCA-20260812-001: a one-time gh-cli confirmation that required_status_checks
// exists is not proof it stays configured — a later manual change to branch
// protection would silently drop this back to "documented but not enforced"
// with no code-level signal. Re-verified on every audit-reality run instead
// of once at fix time. Checks the exact context names, not just a count —
// count alone would pass if 7 unrelated/stale contexts replaced a real Tier
// A job. This list must be updated by hand when a Tier A job is renamed or
// added/removed in .github/workflows/ci.yml — there is no way to derive the
// live GitHub check names from the YAML job names alone (security-scans's
// sub-jobs report as "<parent job name> / <sub-job name>").
const EXPECTED_REQUIRED_CONTEXTS = [
  'Verify (typecheck, lint, format, unit)',
  'Integration (fast, DynamoDB Local)',
  'Dependency Review',
  'npm audit (high/critical)',
  'Security Scans (Semgrep + Gitleaks) / SAST (Semgrep)',
  'Security Scans (Semgrep + Gitleaks) / Secret Detection (Gitleaks)',
  'Validate Infra (Terraform + TFLint + Trivy)',
];

check('required status checks configured on main (strict, exact Tier A set)', () => {
  const strict = execFileSync(
    'gh',
    ['api', `repos/${REPO}/branches/main/protection/required_status_checks`, '--jq', '.strict'],
    { encoding: 'utf8' },
  ).trim();
  if (strict !== 'true') throw new Error(`strict=${strict}, expected true`);

  const contextsOut = execFileSync(
    'gh',
    [
      'api',
      `repos/${REPO}/branches/main/protection/required_status_checks`,
      '--jq',
      '.contexts // .checks',
    ],
    { encoding: 'utf8' },
  ).trim();
  const actual = new Set(JSON.parse(contextsOut));
  const expected = new Set(EXPECTED_REQUIRED_CONTEXTS);

  const missing = [...expected].filter((c) => !actual.has(c));
  const unexpected = [...actual].filter((c) => !expected.has(c));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `missing: [${missing.join(', ')}], unexpected: [${unexpected.join(', ')}]`,
    );
  }
  return `strict=true, ${actual.size} required context(s) match Tier A exactly`;
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
