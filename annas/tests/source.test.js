// Network-free: the toolkit's testKit answers the definition's requests from
// fragments shaped like the site's own, so search, matching and resolve run
// exactly as in production minus the network (and the browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSource, testKit } from '../../../src/sourcekit/index.js';
import { scoreBookRelease, bookTarget } from '../../../src/sources/books.js';
import { annas, parseSearchResults, parseMeta, releaseName, md5Of, fastDownload, slowDownload, parseSlowPage, WANTED_EXTS, SLOW_SERVERS } from '../source.js';
import { SEARCH_HTML, FAST_OK, M_EPUB, M_PDF, M_MOBI, M_DE, M_OTHER, M_TICKER, SLOW_HTML, SLOW_WAIT_HTML, SLOW_CAPTCHA_HTML, PARTNER_URL } from './fixtures.js';

const KEY = 'k-test';
const apiError = (status, error) => () => { throw Object.assign(new Error(`HTTP ${status} from annas-archive.pk`), { status, body: JSON.stringify({ download_url: null, error }) }); };
const routes = {
  're:/search\\?': SEARCH_HTML,
  ['re:/dyn/api/fast_download\\.json\\?md5=' + M_EPUB + '&key=k-test']: FAST_OK,
  're:/dyn/api/fast_download\\.json\\?md5=0{32}&key=k-test': apiError(404, 'Record not found'),
  're:/dyn/api/fast_download\\.json\\?.*key=bad': apiError(401, 'Invalid secret key'),
};
const kitFor = (config = {}) => testKit(annas, routes, { config: { annasKey: KEY, ...config } });
const bookCtx = (extra = {}) => ({
  series: { type: 'ebook', title: 'The Way of Kings' }, seriesTitle: 'The Way of Kings', seriesNames: ['The Way of Kings'],
  issue: { issue_number: '', title: 'The Way of Kings' },
  book: { type: 'ebook', title: 'The Way of Kings', author: 'Brandon Sanderson', year: '2010' },
  ...extra,
});

test('md5Of reads the record id from a site link', () => {
  assert.equal(md5Of(`https://annas-archive.pk/md5/${M_EPUB}`), M_EPUB);
  assert.equal(md5Of('/md5/' + M_EPUB.toUpperCase()), M_EPUB);
  assert.equal(md5Of('/search?q=x'), null);
});

test('parseMeta reads language, file type, size and year; any may be missing', () => {
  assert.deepEqual(parseMeta('English [en] · EPUB · 8.1MB · 2010 · 📕 Book (fiction)'), { ext: 'epub', size: Math.round(8.1 * 1024 * 1024), year: '2010', language: 'English', lang: 'en' });
  assert.deepEqual(parseMeta('PDF · 12.4MB · 📕 Book'), { ext: 'pdf', size: Math.round(12.4 * 1024 * 1024), year: null, language: null, lang: null });
  assert.equal(parseMeta('Chinese (Simplified) [zh-hans] · EPUB · 900KB').lang, 'zh-hans');
  assert.equal(parseMeta('nothing here').ext, null);
});

test('search results: one row per record, the ticker and running-text links skipped', () => {
  const rows = parseSearchResults(SEARCH_HTML, kitFor());
  assert.deepEqual(rows.map((r) => r.md5), [M_EPUB, M_PDF, M_MOBI, M_DE, M_OTHER]);
  const first = rows[0];
  assert.equal(first.name, 'The Way of Kings (The Stormlight Archive #1)');
  assert.equal(first.author, 'Sanderson, Brandon');
  assert.equal(first.ext, 'epub');
  assert.equal(first.lang, 'en');
  assert.equal(first.year, '2010');
  assert.equal(first.size, Math.round(8.1 * 1024 * 1024));
  assert.equal(first.url, `https://annas-archive.pk/md5/${M_EPUB}`);
  assert.equal(first.title, 'Sanderson, Brandon - The Way of Kings (The Stormlight Archive #1) (2010) [en] EPUB');
  assert.equal(rows[1].year, '2010', 'the year falls back to the edition line');
  assert.equal(rows[2].year, '2010');
  assert.ok(!rows.some((r) => r.md5 === M_TICKER));
});

test('releaseName carries author, title, year, language and format for the matcher', () => {
  assert.equal(releaseName({ name: 'Dune', author: 'Frank Herbert', year: '1965', lang: 'en', ext: 'epub' }), 'Frank Herbert - Dune (1965) [en] EPUB');
  assert.equal(releaseName({ name: 'Dune', ext: 'pdf' }), 'Dune PDF');
});

test('search: asks for EPUB and PDF in the accepted languages, keeps only those, and needs the key', async () => {
  const kit = kitFor();
  const rows = await annas.search('Brandon Sanderson The Way of Kings', bookCtx(), kit);
  assert.deepEqual(rows.map((r) => r.md5), [M_OTHER, M_EPUB, M_PDF], 'MOBI and German dropped; EPUB before PDF, larger first (the app re-ranks by match)');
  assert.match(kit.calls[0].url, /\/search\?q=Brandon\+Sanderson\+The\+Way\+of\+Kings&ext=epub&ext=pdf&lang=en$/);
  assert.equal(kit.calls[0].opts.waitFor, 'input[name="q"]');
  // Any language: everything wanted is kept, in file order.
  const anyKit = kitFor({ annasLanguages: '' });
  const any = await annas.search('x', bookCtx(), anyKit);
  assert.equal(any.length, 4);
  assert.doesNotMatch(anyKit.calls[0].url, /lang=/);
  // German first when asked for first.
  const de = await annas.search('x', bookCtx(), kitFor({ annasLanguages: 'de, en' }));
  assert.equal(de[0].md5, M_DE);
  // No key: the search still runs — the free route downloads.
  assert.equal((await annas.search('x', bookCtx(), kitFor({ annasKey: '' }))).length, 3);
});

test('the book matcher picks the EPUB of the wanted book; resolve answers with the API link; a comic library is skipped', async () => {
  const src = defineSource(annas);
  assert.deepEqual(src.types, ['ebook']);
  assert.equal(src.browser, 'required');
  assert.equal(src.card.fields.find((f) => f.key === 'annasKey').secret, true);
  const kit = kitFor();
  const ctx = bookCtx({ config: { annasEnabled: true, annasKey: KEY } });
  // The registered source's find() would use the real network (and the
  // browser), so the offline check runs the same pieces the default find does.
  const rows = await annas.search('Brandon Sanderson The Way of Kings', ctx, kit);
  const scored = rows.map((r) => ({ r, score: scoreBookRelease(r.title, bookTarget(ctx)) })).filter((x) => x.score != null).sort((a, b) => b.score - a.score);
  assert.equal(scored[0].r.md5, M_EPUB, 'the EPUB with author and year outranks the PDF; Words of Radiance does not match');
  assert.ok(!scored.some((x) => x.r.md5 === M_OTHER));

  const r = await annas.resolve(scored[0].r, ctx, kit);
  assert.equal(r.url, FAST_OK.download_url);
  assert.equal(r.referer, 'https://annas-archive.pk/');
  await assert.rejects(fastDownload(kitFor({ annasKey: 'bad' }), M_EPUB), (e) => /Invalid secret key/.test(e.message) && e.noRetry === true);
  await assert.rejects(fastDownload(kitFor({ annasKey: '' }), M_EPUB), /secret key/);
  // No key → the slow partner servers, whose page links the file on another host.
  const slowKit = testKit(annas, { ...routes, ['re:/slow_download/' + M_EPUB + '/0/0']: SLOW_HTML }, { config: { annasKey: '' } });
  const s = await annas.resolve(scored[0].r, ctx, slowKit);
  assert.equal(s.url, PARTNER_URL);
  assert.match(slowKit.calls.at(-1).url, new RegExp('/slow_download/' + M_EPUB + '/0/0$'));
  assert.equal(slowKit.calls.at(-1).opts.waitFor, `a[href*="${M_EPUB}"]`);
  assert.equal(await src.find(bookCtx({ book: undefined, series: { type: 'comic' }, issue: { issue_number: '1' }, config: { annasEnabled: true } })), null, 'never for a comic');
});

test('parseSlowPage: the partner link, a wait, or a captcha', () => {
  const kit = kitFor();
  const ok = parseSlowPage(SLOW_HTML, M_EPUB, kit);
  assert.equal(ok.url, PARTNER_URL, 'the "Download now" link, not the site\'s own md5 link');
  assert.equal(ok.waitSeconds, null);
  assert.equal(ok.captcha, false);
  const wait = parseSlowPage(SLOW_WAIT_HTML, M_EPUB, kit);
  assert.deepEqual([wait.url, wait.waitSeconds, wait.captcha], [null, 5, false]);
  const cap = parseSlowPage(SLOW_CAPTCHA_HTML, M_EPUB, kit);
  assert.deepEqual([cap.url, cap.captcha], [null, true]);
});

test('slowDownload: waits out a short wait once, moves past a captcha, gives up after the last server', async () => {
  let served = 0;
  const kit = testKit(annas, {
    ['re:/slow_download/' + M_EPUB + '/0/0']: SLOW_CAPTCHA_HTML,
    ['re:/slow_download/' + M_EPUB + '/0/1']: () => (++served === 1 ? SLOW_WAIT_HTML : SLOW_HTML),
  }, { config: { annasKey: '' } });
  const slept = [];
  const r = await slowDownload(kit, M_EPUB, { sleep: async (ms) => { slept.push(ms); } });
  assert.equal(r.url, PARTNER_URL);
  assert.equal(r.server, 2);
  assert.deepEqual(slept, [7000], 'the 5s wait plus a margin, once');
  assert.equal(SLOW_SERVERS, 3);
  const none = testKit(annas, { 're:/slow_download/': SLOW_CAPTCHA_HTML }, { config: { annasKey: '' } });
  await assert.rejects(slowDownload(none, M_EPUB), (e) => /no slow partner server gave the file/.test(e.message) && /server #3 asked for a captcha/.test(e.message) && !e.noRetry);
});

test('verify: an EPUB whose own language is not accepted is refused; unknown or accepted passes', async () => {
  const fr = { buffer: Buffer.from('PK\x03\x04') };
  const kitWith = (language) => ({ ...kitFor({ annasLanguages: 'en, de' }), epubInfo: async () => (language === undefined ? null : { title: 'Le Calamity Club', language }) });
  await assert.rejects(annas.verify(fr, { name: 'x' }, {}, kitWith('fr')), /"fr".*not en\/de/);
  await annas.verify(fr, { name: 'x' }, {}, kitWith('en-US'));
  await annas.verify(fr, { name: 'x' }, {}, kitWith('de'));
  await annas.verify(fr, { name: 'x' }, {}, kitWith(undefined), 'no metadata → nothing to refuse on');
  // Any language accepted → never refused.
  await annas.verify(fr, { name: 'x' }, {}, { ...kitFor({ annasLanguages: '' }), epubInfo: async () => ({ language: 'fr' }) });
});

test('test(): the key is checked against the API without spending a download; no key reports the free route', async () => {
  const free = await annas.test(testKit(annas, { ...routes, 're:/dyn/api/fast_download\\.json\\?.*key=none': apiError(401, 'Invalid secret key') }, { config: { annasKey: '' } }));
  assert.equal(free.ok, true);
  assert.match(free.message, /slow partner servers/);
  const bad = await annas.test(kitFor({ annasKey: 'bad' }));
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Invalid secret key/);
  const good = await annas.test(kitFor());
  assert.equal(good.ok, true);
  assert.equal(good.message, 'Connected — the secret key is accepted.');
  assert.deepEqual(WANTED_EXTS, ['epub', 'pdf']);
});
