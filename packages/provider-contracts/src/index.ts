// ADR-006 "EventSourceConnector"; spec-catalog.md §3. Shared, zero-dependency
// types so services/catalog never has to import a connector's internals to
// consume its output — only this contract.

export type ProviderSource = 'tmdb' | 'ticketmaster';

// payload is intentionally unknown: only the normalizer in services/catalog
// is allowed to interpret provider-specific shape (ADR-002 anti-corruption
// layer). Connectors never decode it into domain fields.
export interface RawSourceEvent {
  source: ProviderSource;
  externalId: string;
  fetchedAt: string;
  payload: unknown;
}

export interface CollectionResult {
  events: RawSourceEvent[];
}

export interface ProviderConnector {
  source(): ProviderSource;
  collect(): Promise<CollectionResult>;
}
