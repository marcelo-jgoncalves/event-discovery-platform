#!/usr/bin/env node
// Context consistency check (QR-021, docs/engineering/quality-rules.md):
// trigger fired 2026-08-19 — manual reading kept missing stale "vazio"
// claims and an unmarked expired-debt section (docs/backlog.md
// "Engenharia de contexto"). Checks what's cheaply verifiable without
// NLP/judgment: relative markdown links resolve, and every ADR listed in
// the decisions index has a matching file on disk and vice versa (plus
// duplicate ADR numbers in either direction). Does not (yet) detect prose
// drift like "docs/foo/ está vazio" or a doc referencing a `superseded`
// file as if current — those still need a human/agent read.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, extname } from 'node:path';

export function collectMarkdownFiles(dir) {
  const out = [];
  function walk(current) {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git') continue;
        walk(full);
      } else if (extname(entry) === '.md') {
        out.push(full);
      }
    }
  }
  walk(dir);
  return out;
}

export function checkBrokenLinks(mdFiles, baseDir) {
  const failures = [];
  const linkPattern = /\]\(([^)]+)\)/g;
  for (const file of mdFiles) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(linkPattern)) {
      const target = match[1].split('#')[0];
      if (!target || target.startsWith('http://') || target.startsWith('https://') || target === '') continue;
      const resolved = resolve(dirname(file), target);
      if (!existsSync(resolved)) {
        failures.push(`broken link — ${relative(baseDir, file)} -> ${target}`);
      }
    }
  }
  return failures;
}

export function checkAdrIndex(decisionsDir) {
  const readmePath = join(decisionsDir, 'README.md');
  const adrFilesOnDisk = readdirSync(decisionsDir).filter((f) => /^adr-\d{3}-.*\.md$/.test(f));
  const readme = readFileSync(readmePath, 'utf8');
  const adrIdsInReadme = [...readme.matchAll(/\]\(adr-(\d{3})-[^)]+\.md\)/g)].map((m) => m[1]);
  const adrIdsOnDisk = adrFilesOnDisk.map((f) => f.match(/^adr-(\d{3})-/)[1]);

  const failures = [];
  for (const id of new Set(adrIdsOnDisk)) {
    if (!adrIdsInReadme.includes(id)) failures.push(`ADR-${id} exists on disk but is not referenced in README.md`);
  }
  for (const id of new Set(adrIdsInReadme)) {
    if (!adrIdsOnDisk.includes(id)) failures.push(`ADR-${id} referenced in README.md but has no file on disk`);
  }
  for (const [id, count] of countBy(adrIdsOnDisk)) {
    if (count > 1) failures.push(`ADR-${id} has ${count} files on disk (duplicate number)`);
  }
  for (const [id, count] of countBy(adrIdsInReadme)) {
    if (count > 1) failures.push(`ADR-${id} listed ${count} times in README.md (duplicate entry)`);
  }
  return failures;
}

function countBy(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

// CLI entry point — runs against the real repo, not fixtures. Fixture-based
// proof of both functions lives in quality-self-test.mjs. Guarded so
// importing these functions from quality-self-test.mjs doesn't also run
// this pass against the real repo as a side effect.
const isDirectRun =
  process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('quality/scripts/context-check.mjs');
if (isDirectRun) {
  const ROOT = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '../..');
  const docsDir = join(ROOT, 'docs');
  const rootFiles = [join(ROOT, 'CLAUDE.md'), join(ROOT, 'AGENTS.md'), join(ROOT, 'README.md')].filter(existsSync);
  const mdFiles = [...collectMarkdownFiles(docsDir), ...rootFiles];

  let failures = 0;
  for (const f of checkBrokenLinks(mdFiles, ROOT)) {
    failures += 1;
    console.error(`[context-check] FAIL ${f}`);
  }
  if (failures === 0) {
    console.log(`[context-check] PASS  relative markdown links (${mdFiles.length} files scanned)`);
  }

  const adrFailures = checkAdrIndex(join(docsDir, 'engineering', 'decisions'));
  for (const f of adrFailures) {
    failures += 1;
    console.error(`[context-check] FAIL ${f}`);
  }
  if (adrFailures.length === 0) {
    console.log(`[context-check] PASS  ADR index <-> files (no duplicates)`);
  }

  process.exit(failures > 0 ? 1 : 0);
}
