#!/usr/bin/env node
// Architecture fitness function: the Round 2 defect this closes was a real
// one — cognito-client.ts started calling AdminDeleteUserCommand while
// infrastructure/terraform/modules/identity/main.tf never granted
// cognito-idp:AdminDeleteUser, so the call would fail AccessDenied in real
// AWS with no CI signal (terraform validate/plan don't know what the
// application code calls). This scans each services/<name>/src for AWS SDK
// `*Command` usages against known IAM-scoped clients, derives the expected
// IAM action name by convention (CommandName minus the trailing "Command"),
// and checks infrastructure/terraform/modules/<name>/*.tf grants it.
//
// Convention-based, not a full IAM simulation: only catches the class of bug
// this policy exists for (an SDK command used in code with no matching
// action string anywhere in the service's Terraform module) — a real gap in
// least-privilege review, not a substitute for it.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// AWS SDK package name -> IAM action prefix.
const IAM_PREFIX_BY_PACKAGE = {
  '@aws-sdk/client-cognito-identity-provider': 'cognito-idp',
  '@aws-sdk/client-dynamodb': 'dynamodb',
  '@aws-sdk/lib-dynamodb': 'dynamodb',
};

function listSourceFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

// Matches `import { FooCommand, BarCommand } from '@aws-sdk/client-x';`
const IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;

function extractRequiredActions(sourceDir) {
  const actionsByPrefix = new Map();
  for (const file of listSourceFiles(sourceDir)) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(IMPORT_RE)) {
      const [, names, pkg] = match;
      const prefix = IAM_PREFIX_BY_PACKAGE[pkg];
      if (!prefix) continue;
      for (const rawName of names.split(',')) {
        const name = rawName
          .trim()
          .split(/\s+as\s+/)[0]
          .trim();
        if (!name.endsWith('Command')) continue;
        const action = name.slice(0, -'Command'.length);
        if (!actionsByPrefix.has(prefix)) actionsByPrefix.set(prefix, new Set());
        actionsByPrefix.get(prefix).add(action);
      }
    }
  }
  return actionsByPrefix;
}

export function checkIamActionCoverage(rootDir) {
  const violations = [];
  const servicesDir = join(rootDir, 'services');
  if (!existsSync(servicesDir)) return violations;

  for (const entry of readdirSync(servicesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const serviceName = entry.name;
    const srcDir = join(servicesDir, serviceName, 'src');
    if (!existsSync(srcDir)) continue;

    const required = extractRequiredActions(srcDir);
    if (required.size === 0) continue;

    const moduleDir = join(rootDir, 'infrastructure', 'terraform', 'modules', serviceName);
    let terraformText = '';
    if (existsSync(moduleDir)) {
      for (const tfFile of readdirSync(moduleDir).filter((f) => f.endsWith('.tf'))) {
        terraformText += readFileSync(join(moduleDir, tfFile), 'utf8');
      }
    }

    for (const [prefix, actions] of required) {
      for (const action of actions) {
        const actionString = `${prefix}:${action}`;
        if (!terraformText.includes(actionString)) {
          violations.push({ service: serviceName, action: actionString });
        }
      }
    }
  }

  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.argv[2] ?? process.cwd();
  const violations = checkIamActionCoverage(rootDir);
  if (violations.length > 0) {
    console.error('[fitness-function] iam-action-coverage: VIOLATIONS FOUND');
    for (const v of violations) {
      console.error(
        `  services/${v.service} calls an SDK command requiring "${v.action}", not granted in infrastructure/terraform/modules/${v.service}/`,
      );
    }
    process.exit(1);
  }
  console.log('[fitness-function] iam-action-coverage: OK — 0 violations.');
  process.exit(0);
}
