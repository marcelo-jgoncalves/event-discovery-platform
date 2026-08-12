// Invalid fixture for EDP005: a direct fetch() call to a provider host,
// outside connectors/ — semgrep must reject this (exit 1).
export async function fetchMovie(id: string) {
  return fetch(`https://api.themoviedb.org/3/movie/${id}`);
}
