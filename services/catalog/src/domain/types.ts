// spec-catalog.md §5. Canonical model — no provider-specific field
// (e.g. ticketmasterEventId) ever appears here (ADR-002 anti-corruption
// layer).

export type ResolutionStatus = 'RESOLVED' | 'UNRESOLVED' | 'NOT_APPLICABLE';

export type EventType = 'SCREENING' | 'CONCERT' | 'OTHER';

export interface CanonicalWork {
  canonicalId: string; // "WORK#tmdb:157336"
  type: 'MOVIE';
  title: string;
  normalizedTitle: string;
  originalTitle: string;
  releaseDate?: string;
  overview?: string;
  source: 'tmdb';
  sourceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalEvent {
  canonicalId: string; // "EVENT#ticketmaster:vvG1zZa4e..."
  type: EventType;
  title: string;
  venueId?: string;
  cityName?: string;
  startAt: string;
  status: string;
  workId?: string;
  resolutionStatus: ResolutionStatus;
  source: 'ticketmaster';
  sourceId: string;
  createdAt: string;
  updatedAt: string;
}
