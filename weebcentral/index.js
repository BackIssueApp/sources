// WeebCentral download source plugin for BackIssue.
//
// Built entirely on the app's site-source toolkit: source.js describes how to
// search the site and where a chapter's page images are, and the app supplies
// HTTP, Cloudflare handling, pacing, page assembly, the settings card and the
// Test button. No client code, no core imports.
import { weebcentral } from './source.js';

export default function register(api) {
  if (typeof api.defineSource !== 'function') {
    throw new Error('The WeebCentral plugin needs BackIssue 0.8.2 or newer (it uses api.defineSource).');
  }
  api.defineSource(weebcentral);
}
