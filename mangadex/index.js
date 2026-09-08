// MangaDex download source plugin for BackIssue.
//
// Built entirely on the app's site-source toolkit: the definition in
// source.js says how to find a chapter and where its pages are, and the app
// supplies HTTP, pacing, page assembly, the settings card and the Test
// button. No client code, no core imports.
import { mangadex } from './source.js';

export default function register(api) {
  if (typeof api.defineSource !== 'function') {
    throw new Error('The MangaDex plugin needs BackIssue 0.8.2 or newer (it uses api.defineSource).');
  }
  api.defineSource(mangadex);
}
