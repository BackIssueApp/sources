// Network-free: the toolkit's testKit answers the definition's requests from
// fragments shaped like the site's own, so search, find and resolve run
// exactly as in production minus the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSource, testKit } from '../../../src/sourcekit/index.js';
import {
  weebcentral, seriesId, chapterId, parseSearchResults, parseChapterList,
  parsePageImages, pickSeries, chooseChapter,
} from '../source.js';
import { SEARCH_HTML, CHAPTERS_HTML, IMAGES_HTML, IMAGES_EMPTY, S1, S2, C12, C12B, C13 } from './fixtures.js';

const routes = {
  're:/search/data': SEARCH_HTML,
  [`/series/${S1}/full-chapter-list`]: CHAPTERS_HTML,
  [`/series/${S2}/full-chapter-list`]: '<div></div>',
  're:/chapters/.*/images': IMAGES_HTML,
};
const kitFor = (config = {}) => testKit(weebcentral, routes, { config });
const ctxFor = (extra = {}) => ({ series: { type: 'manga' }, seriesTitle: 'Test Manga', seriesNames: ['Test Manga'], issue: { issue_number: '12' }, ...extra });

test('ids are read from site links', () => {
  assert.equal(seriesId(`https://weebcentral.com/series/${S1}/Test-Manga`), S1);
  assert.equal(seriesId('https://weebcentral.com/series/random'), null);
  assert.equal(chapterId(`https://weebcentral.com/chapters/${C12}`), C12);
  assert.equal(chapterId(null), null);
});

test('search results are one row per series, titled from the text link not the cover badge', () => {
  const rows = parseSearchResults(SEARCH_HTML, kitFor());
  assert.equal(rows.length, 2, 'the two links per result collapse into one row');
  assert.deepEqual(rows.map((r) => r.title), ['Test Manga', 'Test Manga Side Story']);
  assert.equal(rows[0].seriesId, S1);
  assert.equal(rows[0].url, `https://weebcentral.com/series/${S1}/Test-Manga`);
});

test('chapter rows carry the number, ignoring the reading state in the same link', () => {
  const kit = kitFor();
  const chapters = parseChapterList(CHAPTERS_HTML, kit);
  assert.deepEqual(chapters.map((c) => c.number), ['13', '12', '12.5']);
  assert.deepEqual(chapters.map((c) => c.label), ['Chapter 13', 'Chapter 12', 'Chapter 12.5']);
  assert.equal(chapters[0].url, `https://weebcentral.com/chapters/${C13}`);
  assert.equal(chapters[0].published, '2026-02-02T10:00:00.000Z');
  assert.equal(chooseChapter(chapters, '12', kit).id, C12);
  assert.equal(chooseChapter(chapters, '012', kit).id, C12, 'numbers are normalised');
  assert.equal(chooseChapter(chapters, '12.5', kit).id, C12B, 'a half chapter is its own number');
  assert.equal(chooseChapter(chapters, '99', kit), null);
  assert.equal(chooseChapter(chapters, null, kit).id, C13, 'no number wanted → the newest');
});

test('page images skip the site chrome and keep reading order', () => {
  const pages = parsePageImages(IMAGES_HTML, kitFor());
  assert.equal(pages.length, 3);
  assert.ok(pages.every((p) => p.startsWith('https://scans.example.us/')));
  assert.match(pages[0], /0012-001\.png$/);
  assert.deepEqual(parsePageImages(IMAGES_EMPTY, kitFor()), []);
});

test('pickSeries is strict: never a longer title that merely contains the name', () => {
  const kit = kitFor();
  const rows = parseSearchResults(SEARCH_HTML, kit);
  assert.equal(pickSeries(rows, ['Test Manga'], kit)?.seriesId, S1);
  assert.equal(pickSeries(rows, ['Test Manga Side Story'], kit)?.seriesId, S2);
  assert.equal(pickSeries(rows, ['Test'], kit), null);
});

test('find searches, matches the series, then picks the wanted chapter', async () => {
  const kit = kitFor();
  const found = await weebcentral.find(ctxFor(), kit);
  assert.equal(found.chapterId, C12);
  assert.equal(found.title, 'Test Manga Chapter 12');
  assert.equal(found.url, `https://weebcentral.com/chapters/${C12}`);
  assert.ok(kit.calls.some((c) => c.url.includes('/search/data?text=Test%20Manga')));
  assert.ok(kit.calls.some((c) => c.url.includes(`/series/${S1}/full-chapter-list`)));

  assert.equal(await weebcentral.find(ctxFor({ issue: { issue_number: '999' } }), kitFor()), null, 'a missing chapter is not substituted');
  assert.equal(await weebcentral.find(ctxFor({ seriesTitle: 'Unknown', seriesNames: ['Unknown'] }), kitFor()), null);
});

test('resolve returns the pages with the referer the scan host needs', async () => {
  const kit = kitFor();
  const r = await weebcentral.resolve({ chapterId: C12 }, ctxFor(), kit);
  assert.equal(r.pages.length, 3);
  assert.equal(r.referer, 'https://weebcentral.com/');
  assert.ok(kit.calls.some((c) => c.url.includes(`/chapters/${C12}/images`) && c.url.includes('reading_style=long_strip')));
  await assert.rejects(
    weebcentral.resolve({ chapterId: C12 }, ctxFor(), testKit(weebcentral, { 're:/images': IMAGES_EMPTY })),
    (e) => /no page images/.test(e.message) && e.noRetry === true);
});

test('manualSearch lists the matching chapter of each series, exact title first', async () => {
  const r = await weebcentral.manualSearch(ctxFor(), kitFor());
  assert.equal(r.results.length, 1, 'only the series that has chapter 12');
  assert.equal(r.results[0].chapterId, C12);
  assert.equal(r.results[0].score, 100);
  assert.match(r.results[0].meta, /Test Manga · 2026-01-01/);
});

test('the registered source is manga-only, Cloudflare-aware and lean-image first', () => {
  const src = defineSource(weebcentral);
  assert.equal(src.contentKind, 'pages');
  assert.deepEqual(src.types, ['manga']);
  // 'fallback', never 'required': the site is reachable with FlareSolverr, so
  // the source must not force anyone onto the browser image.
  assert.equal(src.browser, 'fallback');
  assert.equal(src.isEnabled({ weebcentralEnabled: true }), true, 'usable on an image with no browser');
  assert.equal(src.card.unavailable, null);
  // FlareSolverr is one shared setting (Settings → Downloading), so the card
  // only asks for what is specific to this site.
  assert.deepEqual(src.card.fields.map((f) => f.key), ['weebcentralUrl']);
  assert.equal(src.card.cloudflare, true);
});
