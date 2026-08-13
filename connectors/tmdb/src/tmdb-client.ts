// spec-catalog.md §3/§9: this file is the only place in the monorepo allowed
// to call api.themoviedb.org directly — provider-isolation fitness function
// (quality/policies/architecture/no-external-provider-call.mjs) enforces it.
// No domain logic here: it returns the provider's own JSON shape untouched.

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

export interface TmdbNowPlayingResponse {
  results: unknown[];
}

export class TmdbClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    fetchImpl: typeof fetch = fetch,
    baseUrl: string = TMDB_API_BASE_URL,
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
  }

  async fetchNowPlaying(): Promise<TmdbNowPlayingResponse> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/movie/now_playing?api_key=${this.apiKey}&region=BR`,
    );
    if (!response.ok) {
      throw new Error(`TMDB now_playing request failed: ${response.status}`);
    }
    return (await response.json()) as TmdbNowPlayingResponse;
  }
}
