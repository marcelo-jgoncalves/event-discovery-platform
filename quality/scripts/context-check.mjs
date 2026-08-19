#!/usr/bin/env node
// Context consistency check (docs/context-strategy.md §11, trigger fired
// 2026-08-19: manual reading kept missing stale "vazio" claims and an
// unmarked expired-debt section — see docs/backlog.md "Engenharia de
// contexto"). Checks what's cheaply verifiable without NLP/judgment:
// relative markdown links resolve, and every ADR listed in the decisions
// index has a matching file on disk and vice versa. Does not (yet) detect
// prose drift like "docs/foo/ está vazio" — that still needs a human/agent
// read; this only catches the mechanical class of breakage.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, extname } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '../..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'history') continue;
      walk(full, out);
    } else if (extname(entry) === '.md') {
      out.push(full);
    }
  }
  return out;
}

const docsDir = join(ROOT, 'docs');
const mdFiles = [...walk(docsDir), join(ROOT, 'CLAUDE.md'), join(ROOT, 'AGENTS.md'), join(ROOT, 'README.md')].filter(
  existsSync,
);

let failures = 0;

const linkPattern = /\]\(([^)]+)\)/g;
for (const file of mdFiles) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1].split('#')[0];
    if (!target || target.startsWith('http://') || target.startsWith('https://') || target === '') continue;
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved)) {
      failures += 1;
      console.error(`[context-check] FAIL broken link — ${relative(ROOT, file)} -> ${target}`);
    }
  }
}
if (failures === 0) {
  console.log(`[context-check] PASS  relative markdown links (${mdFiles.length} files scanned)`);
}

const decisionsDir = join(docsDir, 'engineering', 'decisions');
const readmePath = join(decisionsDir, 'README.md');
const adrFilesOnDisk = readdirSync(decisionsDir).filter((f) => /^adr-\d{3}-.*\.md$/.test(f));
const readme = readFileSync(readmePath, 'utf8');
const adrIdsInReadme = [...readme.matchAll(/\]\(adr-(\d{3})-[^)]+\.md\)/g)].map((m) => m[1]);
const adrIdsOnDisk = adrFilesOnDisk.map((f) => f.match(/^adr-(\d{3})-/)[1]);

for (const id of new Set(adrIdsOnDisk)) {
  if (!adrIdsInReadme.includes(id)) {
    failures += 1;
    console.error(`[context-check] FAIL ADR-${id} exists on disk but is not referenced in decisions/README.md`);
  }
}
for (const id of new Set(adrIdsInReadme)) {
  if (!adrIdsOnDisk.includes(id)) {
    failures += 1;
    console.error(`[context-check] FAIL ADR-${id} referenced in decisions/README.md but has no file on disk`);
  }
}
if (failures === 0) {
  console.log(`[context-check] PASS  ADR index <-> files (${adrIdsOnDisk.length} ADRs)`);
}

process.exit(failures > 0 ? 1 : 0);
