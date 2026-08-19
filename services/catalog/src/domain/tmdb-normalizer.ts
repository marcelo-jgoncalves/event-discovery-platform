import { z } from 'zod';
import type { RawSourceEvent } from '@edp/provider-contracts';
import { buildCanonicalId } from './canonical-id.ts';
import { normalizeTitle } from './normalize-title.ts';
import type { CanonicalWork } from './types.ts';

// TMDB movie shape (subset used by this normalizer) — kept local, never
// exported: this is the one place allowed to know TMDB's field names
// (ADR-002 anti-corruption layer). Validated at runtime, not just typed,
// because this is an external-provider boundary (code-conventions.md) —
// a type cast alone does not catch a provider sending null/missing fields.
const tmdbMoviePayloadSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  original_title: z.string().min(1),
  release_date: z.string().optional(),
  overview: z.string().optional(),
});

export function normalizeTmdbMovie(raw: RawSourceEvent, now: string): CanonicalWork {
  if (raw.source !== 'tmdb') {
    throw new Error(`normalizeTmdbMovie received a non-tmdb RawSourceEvent: ${raw.source}`);
  }
  const movie = tmdbMoviePayloadSchema.parse(raw.payload);

  return {
    canonicalId: buildCanonicalId('WORK', 'tmdb', String(movie.id)),
    type: 'MOVIE',
    title: movie.title,
    normalizedTitle: normalizeTitle(movie.title),
    originalTitle: movie.original_title,
    releaseDate: movie.release_date,
    overview: movie.overview,
    source: 'tmdb',
    sourceId: String(movie.id),
    createdAt: now,
    updatedAt: now,
  };
}
