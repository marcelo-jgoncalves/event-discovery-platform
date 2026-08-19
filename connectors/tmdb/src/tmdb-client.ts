// spec-catalog.md §3/§9: this file is the only place in the monorepo allowed
// to call api.themoviedb.org directly — provider-isolation fitness function
// (quality/policies/architecture/no-external-provider-call.mjs) enforces it.
// No domain logic here: it returns the provider's own JSON shape untouched.

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

// A fetch with no deadline can hang the ingestion Lambda for its full
// timeout on a stalled connection instead of failing fast and letting the
// caller retry — same class of bug as an unbounded read. 10s is generous for
// a single JSON page from this provider.
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export interface TmdbNowPlayingResponse {
  results: unknown[];
}

export class TmdbClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    apiKey: string,
    fetchImpl: typeof fetch = fetch,
    baseUrl: string = TMDB_API_BASE_URL,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async fetchNowPlaying(): Promise<TmdbNowPlayingResponse> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/movie/now_playing?api_key=${this.apiKey}&region=BR`,
      { signal: AbortSignal.timeout(this.timeoutMs) },
    );
    if (!response.ok) {
      throw new Error(`TMDB now_playing request failed: ${response.status}`);
    }
    return (await response.json()) as TmdbNowPlayingResponse;
  }
}
