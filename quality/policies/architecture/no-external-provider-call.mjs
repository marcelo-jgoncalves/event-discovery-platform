#!/usr/bin/env node
// Architecture Fitness Function (ADR-011, ADR-006 provider boundary;
// docs/backlog.md "Quality enforcement system" trigger: connectors/tmdb and
// connectors/ticketmaster now have first real code).
//
// Rule: no module outside connectors/tmdb may reference the TMDB API host
// (api.themoviedb.org), and no module outside connectors/ticketmaster may
// reference the Ticketmaster API host (app.ticketmaster.com) — those two
// directories are the only place in the monorepo allowed to call the
// provider's HTTP API directly (spec-catalog.md §3, ADR-006).
//
// Scans source text for the literal host string rather than doing full call
// graph analysis — cheap, dependency-free, and sufficient: any occurrence of
// the host string outside the allowed connector directory is a violation
// regardless of how the call is constructed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROVIDER_HOSTS = [
  { host: 'api.themoviedb.org', allowedPrefix: join('connectors', 'tmdb') },
  { host: 'app.ticketmaster.com', allowedPrefix: join('connectors', 'ticketmaster') },
];
const SCAN_ROOTS = ['apps', 'services', 'connectors', 'packages'];

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
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

export function checkNoExternalProviderCall(rootDir) {
  const violations = [];

  for (const root of SCAN_ROOTS) {
    const dir = join(rootDir, root);
    let exists = true;
    try {
      statSync(dir);
    } catch {
      exists = false;
    }
    if (!exists) continue;

    for (const file of listSourceFiles(dir)) {
      const relPath = relative(rootDir, file);
      const content = readFileSync(file, 'utf8');

      for (const { host, allowedPrefix } of PROVIDER_HOSTS) {
        const isAllowed = relPath.startsWith(allowedPrefix + sep);
        if (isAllowed) continue;
        if (content.includes(host)) {
          violations.push({ file: relPath, host });
        }
      }
    }
  }

  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.argv[2] ?? process.cwd();
  const violations = checkNoExternalProviderCall(rootDir);
  if (violations.length > 0) {
    console.error('[fitness-function] no-external-provider-call: VIOLATIONS FOUND');
    for (const v of violations) {
      console.error(`  ${v.file} references provider host "${v.host}" outside its connector`);
    }
    process.exit(1);
  }
  console.log('[fitness-function] no-external-provider-call: OK — 0 violations.');
  process.exit(0);
}
