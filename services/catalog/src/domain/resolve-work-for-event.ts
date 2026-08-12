import type { CanonicalEvent, CanonicalWork, ResolutionStatus } from './types.ts';
import { isFilmScreening } from './ticketmaster-normalizer.ts';

export interface WorkResolution {
  workId?: string;
  resolutionStatus: ResolutionStatus;
}

// spec-catalog.md §7 — ADR-002 level-2 composite rule, restricted to the one
// signal available today (exact normalized-title match). Pure: candidates
// are passed in already fetched by the caller (WORKTITLE Query in the
// application layer) so this stays unit-testable without I/O.
export function resolveWorkForEvent(
  event: CanonicalEvent,
  candidateWorks: CanonicalWork[],
): WorkResolution {
  if (!isFilmScreening(event.type)) {
    return { resolutionStatus: 'NOT_APPLICABLE' };
  }

  if (candidateWorks.length === 1) {
    return { workId: candidateWorks[0]?.canonicalId, resolutionStatus: 'RESOLVED' };
  }

  // 0 candidates (no matching Work ingested yet) or >1 (ambiguous title,
  // e.g. a remake) — both go to the review queue, never guessed.
  return { resolutionStatus: 'UNRESOLVED' };
}
