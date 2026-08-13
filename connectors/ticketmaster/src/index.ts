import type { CollectionResult, ProviderConnector, ProviderSource } from '@edp/provider-contracts';
import { TicketmasterClient } from './ticketmaster-client.ts';

// ProviderConnector implementation (ADR-006). collect() is the only public
// surface consumed by services/catalog — the domain never sees
// TicketmasterClient or the Ticketmaster response shape directly
// (spec-catalog.md §3). MVP city is Belo Horizonte (docs/product/vision.md).
const MVP_CITY = 'Belo Horizonte';

export class TicketmasterConnector implements ProviderConnector {
  private readonly client: TicketmasterClient;
  private readonly city: string;

  constructor(client: TicketmasterClient, city: string = MVP_CITY) {
    this.client = client;
    this.city = city;
  }

  source(): ProviderSource {
    return 'ticketmaster';
  }

  async collect(): Promise<CollectionResult> {
    const fetchedAt = new Date().toISOString();
    const response = await this.client.fetchEvents(this.city);
    const events = response._embedded?.events ?? [];

    return {
      events: events.map((event) => {
        const id = (event as { id: string }).id;
        return {
          source: 'ticketmaster' as const,
          externalId: id,
          fetchedAt,
          payload: event,
        };
      }),
    };
  }
}

export { TicketmasterClient } from './ticketmaster-client.ts';
