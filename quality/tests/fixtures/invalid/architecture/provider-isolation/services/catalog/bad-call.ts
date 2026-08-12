// Invalid fixture for the no-external-provider-call fitness function: a
// module outside connectors/tmdb calling the TMDB API host directly.
export async function fetchMovie(id: string) {
  return fetch(`https://api.themoviedb.org/3/movie/${id}`);
}
