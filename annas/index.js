// Anna's Archive download source for BackIssue.
//
// Built entirely on the app's site-source toolkit: source.js describes how to
// search the site and how a file is fetched through its member API, and the
// app supplies HTTP, the browser that clears the site's DDoS-Guard check,
// pacing, the book matcher, the settings card and the Test button. No client
// code, no core imports.
import { annas } from './source.js';

export default function register(api) {
  if (typeof api.defineSource !== 'function') {
    throw new Error("The Anna's Archive source needs BackIssue 0.8.4 or newer (it uses api.defineSource for books).");
  }
  api.defineSource(annas);
}
