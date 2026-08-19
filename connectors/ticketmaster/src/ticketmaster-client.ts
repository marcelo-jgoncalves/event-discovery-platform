// spec-catalog.md §3/§9: this file is the only place in the monorepo allowed
// to call app.ticketmaster.com directly — provider-isolation fitness
// function (quality/policies/architecture/no-external-provider-call.mjs)
// enforces it. No domain logic here: it returns the provider's own JSON
// shape untouched.

const TICKETMASTER_API_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

// Engineering-quality review (2026-08-19): see tmdb-client.ts for why this
// exists — a fetch with no deadline can hang the ingestion Lambda instead of
// failing fast.
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export interface TicketmasterEventSearchResponse {
  _embedded?: { events: unknown[] };
}

export class TicketmasterClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    apiKey: string,
    fetchImpl: typeof fetch = fetch,
    baseUrl: string = TICKETMASTER_API_BASE_URL,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async fetchEvents(city: string): Promise<TicketmasterEventSearchResponse> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/events.json?apikey=${this.apiKey}&city=${encodeURIComponent(city)}`,
      { signal: AbortSignal.timeout(this.timeoutMs) },
    );
    if (!response.ok) {
      throw new Error(`Ticketmaster events request failed: ${response.status}`);
    }
    return (await response.json()) as TicketmasterEventSearchResponse;
  }
}
