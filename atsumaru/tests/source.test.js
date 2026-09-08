// Network-free: the toolkit's testKit answers the definition's requests from
// fixtures shaped like the site's own, so search, find and resolve run exactly
// as in production minus the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSource, testKit } from '../../../src/sourcekit/index.js';
import {
  atsumaru, parseSearch, parseChapters, parsePages, pickTitle, chooseChapter,
} from '../source.js';
import { SEARCH, CHAPTERS, PAGES, PAGES_EMPTY, M1, M2 } from './fixtures.js';

const routes = {
  're:/collections/manga/documents/search': SEARCH,
  're:/api/manga/allChapters': CHAPTERS,
  're:/api/read/chapter': PAGES,
};
const kitFor = (config = {}) => testKit(atsumaru, routes, { config });
const ctxFor = (extra = {}) => ({ series: { type: 'manga' }, seriesTitle: 'Test Manga', seriesNames: ['Test Manga'], issue: { issue_number: '12' }, ...extra });

test('search hits keep the site\'s own alternate names', () => {
  const rows = parseSearch(SEARCH);
  assert.deepEqual(rows.map((r) => r.title), ['Test Manga', 'Test Manga: Side Story']);
  assert.equal(rows[0].mangaId, M1);
  assert.deepEqual(rows[0].names, ['Test Manga', 'Tesuto Manga']);
  assert.equal(rows[0].year, '2019');
  assert.equal(rows[0].chapters, 13);
});

test('the chapter feed carries numbers, page counts and upload times', () => {
  const chapters = parseChapters(CHAPTERS);
  assert.deepEqual(chapters.map((c) => c.number), ['13', '12', '12', '11']);
  assert.equal(chapters[1].pages, 22);
  assert.equal(chapters[0].id, 'c13');
});

test('pages are put in reading order and made absolute', () => {
  const pages = parsePages(PAGES, 'https://atsu.moe');
  assert.deepEqual(pages, [
    'https://atsu.moe/static/pages/scan1/c12b/0.webp',
    'https://atsu.moe/static/pages/scan1/c12b/1.webp',
    'https://atsu.moe/static/pages/scan1/c12b/2.webp',
  ]);
  assert.deepEqual(parsePages(PAGES_EMPTY), []);
  // An image that is already absolute is left alone.
  assert.deepEqual(parsePages({ pages: [{ image: 'https://cdn.example/x.webp', number: 0 }] }), ['https://cdn.example/x.webp']);
});

test('pickTitle matches an alternate name, but never a longer title', () => {
  const kit = kitFor();
  const rows = parseSearch(SEARCH);
  assert.equal(pickTitle(rows, ['Test Manga'], kit)?.mangaId, M1);
  assert.equal(pickTitle(rows, ['Tesuto Manga'], kit)?.mangaId, M1, 'the site\'s own alternate counts');
  assert.equal(pickTitle(rows, ['Test Manga: Side Story'], kit)?.mangaId, M2);
  assert.equal(pickTitle(rows, ['Test'], kit), null);
});

test('chooseChapter takes the wanted number, newest upload when it repeats', () => {
  const kit = kitFor();
  const chapters = parseChapters(CHAPTERS);
  assert.equal(chooseChapter(chapters, '12', kit).id, 'c12b', 'the later re-upload wins');
  assert.equal(chooseChapter(chapters, '012', kit).id, 'c12b', 'numbers are normalised');
  assert.equal(chooseChapter(chapters, '11', kit).id, 'c11');
  assert.equal(chooseChapter(chapters, '99', kit), null);
  assert.equal(chooseChapter(chapters, null, kit).id, 'c13', 'no number wanted → the newest');
});

test('find searches, matches the series, then picks the chapter', async () => {
  const kit = kitFor();
  const found = await atsumaru.find(ctxFor(), kit);
  assert.equal(found.mangaId, M1);
  assert.equal(found.chapterId, 'c12b');
  assert.equal(found.title, 'Test Manga Chapter 12');
  assert.equal(found.url, `https://atsu.moe/read/${M1}/c12b`);
  const search = kit.calls.find((c) => c.url.includes('/collections/manga/documents/search'));
  assert.match(search.url, /q=Test\+Manga|q=Test%20Manga/);
  assert.match(search.url, /query_by=title%2CenglishTitle%2CotherNames%2Cauthors/);
  assert.ok(kit.calls.some((c) => c.url.includes(`/api/manga/allChapters?mangaId=${M1}`)));

  assert.equal(await atsumaru.find(ctxFor({ issue: { issue_number: '999' } }), kitFor()), null);
  assert.equal(await atsumaru.find(ctxFor({ seriesTitle: 'Unknown', seriesNames: ['Unknown'] }), kitFor()), null);
});

test('resolve returns the chapter pages, and says so when there are none', async () => {
  const kit = kitFor();
  const r = await atsumaru.resolve({ mangaId: M1, chapterId: 'c12b' }, ctxFor(), kit);
  assert.equal(r.pages.length, 3);
  assert.equal(r.referer, 'https://atsu.moe/');
  assert.ok(kit.calls.some((c) => c.url.includes(`/api/read/chapter?mangaId=${M1}&chapterId=c12b`)));

  const empty = testKit(atsumaru, { 're:/api/read/chapter': PAGES_EMPTY });
  await assert.rejects(atsumaru.resolve({ mangaId: M1, chapterId: 'c11' }, ctxFor(), empty),
    (e) => /no page images/.test(e.message) && e.noRetry === true);
  await assert.rejects(atsumaru.resolve({ mangaId: M1 }, ctxFor(), kitFor()), /no chapter to read/);
});

test('manualSearch lists the matching chapters, exact series first', async () => {
  const r = await atsumaru.manualSearch(ctxFor(), kitFor());
  assert.deepEqual(r.searched, ['Test Manga']);
  assert.equal(r.results.length, 2, 'both uploads of chapter 12');
  assert.ok(r.results.every((x) => x.score === 100));
  assert.match(r.results[0].meta, /Test Manga · \d+ pages/);
});

test('the registered source runs on the standard build: no browser, no Cloudflare', () => {
  const src = defineSource(atsumaru);
  assert.equal(src.contentKind, 'pages');
  assert.deepEqual(src.types, ['manga']);
  assert.equal(src.browser, null);
  assert.equal(src.card.cloudflare, false);
  assert.deepEqual(src.card.fields.map((f) => f.key), ['atsumaruUrl']);
  assert.equal(src.isEnabled({ atsumaruEnabled: true }), true);
  assert.equal(src.isEnabled({}), false);
});
