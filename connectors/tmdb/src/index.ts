import type { CollectionResult, ProviderConnector, ProviderSource } from '@edp/provider-contracts';
import { TmdbClient } from './tmdb-client.ts';

// ProviderConnector implementation (ADR-006). collect() is the only public
// surface consumed by services/catalog — the domain never sees TmdbClient or
// the TMDB response shape directly (spec-catalog.md §3).
export class TmdbConnector implements ProviderConnector {
  private readonly client: TmdbClient;

  constructor(client: TmdbClient) {
    this.client = client;
  }

  source(): ProviderSource {
    return 'tmdb';
  }

  async collect(): Promise<CollectionResult> {
    const fetchedAt = new Date().toISOString();
    const response = await this.client.fetchNowPlaying();

    return {
      events: response.results.map((movie) => {
        const id = (movie as { id: number }).id;
        return {
          source: 'tmdb' as const,
          externalId: String(id),
          fetchedAt,
          payload: movie,
        };
      }),
    };
  }
}

export { TmdbClient } from './tmdb-client.ts';
