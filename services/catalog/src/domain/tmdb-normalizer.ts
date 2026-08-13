import type { RawSourceEvent } from '@edp/provider-contracts';
import { buildCanonicalId } from './canonical-id.ts';
import { normalizeTitle } from './normalize-title.ts';
import type { CanonicalWork } from './types.ts';

// TMDB movie shape (subset used by this normalizer) — kept local, never
// exported: this is the one place allowed to know TMDB's field names
// (ADR-002 anti-corruption layer).
interface TmdbMoviePayload {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  overview?: string;
}

export function normalizeTmdbMovie(raw: RawSourceEvent, now: string): CanonicalWork {
  if (raw.source !== 'tmdb') {
    throw new Error(`normalizeTmdbMovie received a non-tmdb RawSourceEvent: ${raw.source}`);
  }
  const movie = raw.payload as TmdbMoviePayload;

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
