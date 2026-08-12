// Valid fixture for EDP005: consumes a provider through the ProviderConnector
// contract instead of calling the provider's HTTP API directly — semgrep
// must accept this (exit 0).
import type { ProviderConnector } from '@edp/provider-contracts';

export async function ingestFromConnector(connector: ProviderConnector) {
  return connector.collect();
}
