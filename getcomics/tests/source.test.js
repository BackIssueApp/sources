// The site's own logic, network-free: the toolkit's testKit answers the
// definition's requests from the recorded fixtures, so search, resolve and
// the pack path run exactly as in production minus the network. The HTTP,
// Cloudflare handling, mirror fallback and archive checks live in the toolkit
// and are covered by the app's own tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSource, testKit } from '../../../src/sourcekit/index.js';
import { getcomics, postLinks, toDownloadLink } from '../source.js';
import { SEARCH_HTML, POST_HTML } from './fixtures.js';

const routes = { 're:\\?s=': SEARCH_HTML, '/saga-012-2013/': POST_HTML };
const kitFor = (extra = {}) => testKit(getcomics, { ...routes, ...extra });
const SAGA = 'https://getcomics.org/other-comics/saga-012-2013/';
const ctxFor = (extra = {}) => ({
  series: { type: 'comic' }, seriesTitle: 'Saga', seriesNames: ['Saga'],
  seriesYear: 2013, issue: { issue_number: '12' }, ...extra,
});

test('search returns the site\'s posts, keeping the post URL as the download identity', async () => {
  const kit = kitFor();
  const rows = await getcomics.search('saga 12', ctxFor(), kit);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].title, 'Saga #12 (2013)');
  assert.equal(rows[0].url, SAGA);
  assert.equal(rows[0].postUrl, SAGA, 'the pack grab records this as the download id');
  assert.equal(rows[0].size, 38_000_000);
});

test('the exact issue wins over a collected volume and over the same number of another series', async () => {
  const kit = kitFor();
  const rows = await getcomics.search('saga 12', ctxFor(), kit);
  const pick = (ctx) => kit.match.pickBest(rows, kit.match.autoTarget(ctx, ctx.seriesNames));
  assert.equal(pick(ctxFor()).r.url, SAGA);
  assert.equal(pick(ctxFor({ issue: { issue_number: '99' } })), null, 'an issue nobody posted is not substituted');
  assert.equal(pick(ctxFor({ seriesTitle: 'Nonexistent', seriesNames: ['Nonexistent'] })), null);
});

test('the site is searched by bare issue number, never the padded token', async () => {
  const m = await getcomics.manualSearch(ctxFor(), kitFor());
  assert.deepEqual(m.searched, ['Saga 12']);
  const padded = await getcomics.manualSearch(ctxFor({ issue: { issue_number: '012' } }), kitFor());
  assert.deepEqual(padded.searched, ['Saga 12']);
  const none = await getcomics.manualSearch(ctxFor({ issue: { issue_number: null } }), kitFor());
  assert.deepEqual(none.searched, ['Saga'], 'a numberless issue searches the name alone');
});

test('resolve offers the supported hosts in order, and PixelDrain by direct URL', async () => {
  const kit = kitFor();
  const r = await getcomics.resolve({ postUrl: SAGA }, ctxFor(), kit);
  assert.equal(r.referer, SAGA);
  assert.deepEqual(r.links.map((l) => l.label), ['GetComics', 'PixelDrain']);
  assert.match(r.links[1].url, /pixeldrain\.com\/api\/file\//, 'the share link becomes a file URL');
  assert.match(r.links[1].hint403, /free transfer limit/, 'a refusal from this host explains itself');
  // `button` marks the post's own primary download (the pack part marker on
  // a multi-part post); these fixture links are mirrors, so none is one.
  assert.deepEqual(r.links.map((l) => l.button), [false, false]);
});

test('a PixelDrain album is asked for its files and the comic among them is taken', async () => {
  const kit = kitFor({ 'pixeldrain.com/api/list/': { files: [{ id: 'x1', name: 'cover.jpg', size: 900 }, { id: 'x2', name: 'Saga 012.cbz', size: 40_000_000 }] } });
  const link = await toDownloadLink({ host: 'pixeldrain', url: 'https://pixeldrain.com/l/albumid', button: false }, kit);
  assert.equal(link.url, 'https://pixeldrain.com/api/file/x2?download');
  const empty = kitFor({ 'pixeldrain.com/api/list/': { files: [] } });
  await assert.rejects(toDownloadLink({ host: 'pixeldrain', url: 'https://pixeldrain.com/l/albumid' }, empty), /no downloadable file/);
});

test('a post offering only cloud lockers says so, and says it is not worth retrying', async () => {
  const kit = kitFor({ '/cloud-only/': '<div class="aio-button-center"><a href="https://mega.nz/file/x" class="aio-button">MEGA</a></div>' });
  await assert.rejects(
    postLinks({ postUrl: 'https://getcomics.org/cloud-only/' }, kit),
    (e) => /only offers mega/i.test(e.message) && e.noRetry === true);
});

test('manualSearch is broad: packs are labelled, near-misses still offered', async () => {
  const r = await getcomics.manualSearch(ctxFor(), kitFor());
  const titles = r.results.map((x) => x.title);
  assert.ok(titles.includes('Saga #12 (2013)'));
  const pack = r.results.find((x) => x.isPack);
  assert.ok(pack, 'a collected volume is offered as a pack');
  assert.equal(pack.meta, 'getcomics · pack');
  assert.equal(r.results.find((x) => x.title === 'Saga #12 (2013)').score, 120, 'the exact issue scores highest');
  assert.ok(r.results.every((x) => x.postUrl && x.source === 'getcomics'));
});

test('the registered source: an archive source with a shared FlareSolverr and a proxy option', () => {
  const src = defineSource(getcomics);
  assert.equal(src.kind, 'immediate');
  assert.equal(src.contentKind, 'archive');
  assert.equal(src.isEnabled({ getcomicsEnabled: true }), true);
  assert.equal(src.isEnabled({}), false, 'off until switched on');
  assert.equal(typeof src.fetchPack, 'function', 'multi-issue packs still work');
  assert.equal(src.card.cloudflare, true);
  assert.deepEqual(src.types, ['comic'], 'a manga library never spends a search here');
  // Only what is specific to this site is asked for; FlareSolverr is shared.
  assert.deepEqual(src.card.fields.map((f) => f.key), ['getcomicsUrl', 'getcomicsDownloadProxy']);
  assert.equal(src.card.testable, true);
});
