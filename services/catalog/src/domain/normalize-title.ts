// spec-catalog.md §7. Used only as a lookup key for the WORKTITLE companion
// item (ADR-013) — never shown to the user.

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation
    .trim()
    .replace(/\s+/g, ' ');
}
