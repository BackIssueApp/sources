// GetComics download source plugin for BackIssue.
//
// A direct-download source: it searches the site for a wanted issue, resolves
// the post's download link (its own server, else PixelDrain), fetches the
// archive and hands it to the app to tag and file. No external client.
//
// Everything that is not knowledge of this site — HTTP, Cloudflare handling
// via the shared FlareSolverr, request pacing, mirror fallback, archive
// checks, the settings card and its Test button — comes from the app's
// site-source toolkit, so this file is only the registration.
import { getcomics } from './source.js';

export default function register(api) {
  if (typeof api.defineSource !== 'function') {
    throw new Error('The GetComics source needs BackIssue 0.8.2 or newer.');
  }
  api.defineSource(getcomics);
}
