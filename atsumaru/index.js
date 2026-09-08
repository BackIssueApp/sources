// Atsumaru download source plugin for BackIssue.
//
// Built on the app's site-source toolkit: source.js says how to search the
// site, how to list a title's chapters and where a chapter's page images are,
// and the app supplies HTTP, pacing, page assembly, the settings card and the
// Test button. No client code, no core imports.
import { atsumaru } from './source.js';

export default function register(api) {
  if (typeof api.defineSource !== 'function') {
    throw new Error('The Atsumaru plugin needs BackIssue 0.8.2 or newer (it uses api.defineSource).');
  }
  api.defineSource(atsumaru);
}
