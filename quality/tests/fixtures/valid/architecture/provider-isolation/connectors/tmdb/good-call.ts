// Valid fixture for the no-external-provider-call fitness function: the TMDB
// API host is only referenced from inside connectors/tmdb, which is allowed.
export async function fetchMovie(id: string) {
  return fetch(`https://api.themoviedb.org/3/movie/${id}`);
}
