// ADR-002 Canonical Target ID format: <TYPE>#<namespace>:<id>. The namespace
// is part of the identifier itself so IDs from different providers are never
// accidentally treated as equivalent.

export function buildCanonicalId(
  type: 'WORK' | 'EVENT',
  namespace: 'tmdb' | 'ticketmaster',
  sourceId: string,
): string {
  return `${type}#${namespace}:${sourceId}`;
}
