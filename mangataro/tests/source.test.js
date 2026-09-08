// Network-free: the toolkit's testKit answers the definition's requests from
// fixtures shaped like the site's own, so search, find and resolve run exactly
// as in production minus the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSource, testKit } from '../../../src/sourcekit/index.js';
import {
  mangataro, signature, chapterIdFrom, parseSearchRows, parseChapters,
  pickTitle, chooseChapter,
} from '../source.js';
import { SEARCH, CHAPTERS, PAGES, PAGES_TEXT, M1, M2 } from './fixtures.js';

const routes = {
  're:/wp-json/manga/v1/load': SEARCH,
  're:/auth/manga-chapters': CHAPTERS,
  're:/auth/chapter-content': PAGES,
};
const kitFor = (config = {}) => testKit(mangataro, routes, { config });
const ctxFor = (extra = {}) => ({ series: { type: 'manga' }, seriesTitle: 'Test Manga', seriesNames: ['Test Manga'], issue: { issue_number: '12' }, ...extra });

test('the request signature is the hour it was made, so it is reproducible', () => {
  // 2026-09-08T12:34:56Z → the UTC hour stamp 2026090812.
  const ts = Math.floor(Date.parse('2026-09-08T12:34:56Z') / 1000);
  const sig = signature(ts);
  assert.match(sig, /^[0-9a-f]{16}$/);
  assert.equal(sig, signature(ts), 'the same second always signs the same');
  assert.notEqual(sig, signature(ts + 3600), 'a later hour signs differently');
});

test('a chapter id is read from its reader link', () => {
  assert.equal(chapterIdFrom('https://mangataro.org/read/test-manga/ch12-900012'), '900012');
  assert.equal(chapterIdFrom('https://mangataro.org/read/test-manga/ch12-900012/'), '900012');
  assert.equal(chapterIdFrom('https://mangataro.org/manga/test-manga'), null);
});

test('catalogue rows drop novels, which have no pages to download', () => {
  const rows = parseSearchRows(SEARCH);
  assert.deepEqual(rows.map((r) => r.title), ['Test Manga', 'Test Manga: Side Story']);
  assert.equal(rows[0].mangaId, M1);
  assert.equal(rows[0].year, '2019');
});

test('the chapter feed keeps numbers, languages, groups and marks text chapters', () => {
  const chapters = parseChapters(CHAPTERS);
  assert.equal(chapters.length, 5);
  assert.deepEqual(chapters.map((c) => c.number), ['13', '12', '12', '12', '11']);
  assert.equal(chapters[0].title, null, 'a placeholder title is not a title');
  assert.equal(chapters[1].group, 'New Group');
  assert.equal(chapters[3].language, 'es');
  assert.equal(chapters.at(-1).text, true, 'a prose chapter is flagged');
});

test('chooseChapter honours the number, then language order, then the newest upload', () => {
  const kit = kitFor();
  const chapters = parseChapters(CHAPTERS);
  assert.equal(chooseChapter(chapters, '12', ['en'], kit).id, '900012', 'newest English upload');
  assert.equal(chooseChapter(chapters, '12', ['es', 'en'], kit).id, '900010', 'first language wins');
  assert.equal(chooseChapter(chapters, '012', ['en'], kit).id, '900012', 'numbers are normalised');
  assert.equal(chooseChapter(chapters, '11', ['en'], kit), null, 'a text chapter is never chosen');
  assert.equal(chooseChapter(chapters, '99', ['en'], kit), null);
});

test('pickTitle is strict: never a longer title that merely starts the same', () => {
  const kit = kitFor();
  const rows = parseSearchRows(SEARCH);
  assert.equal(pickTitle(rows, ['Test Manga'], kit)?.mangaId, M1);
  assert.equal(pickTitle(rows, ['Test Manga: Side Story'], kit)?.mangaId, M2);
  assert.equal(pickTitle(rows, ['Test'], kit), null);
});

test('find searches, matches the series, then picks the chapter', async () => {
  const kit = kitFor();
  const found = await mangataro.find(ctxFor(), kit);
  assert.equal(found.chapterId, '900012');
  assert.equal(found.title, 'Test Manga Chapter 12');
  assert.equal(found.url, 'https://mangataro.org/read/test-manga/ch12-900012');
  const search = kit.calls.find((c) => c.url.includes('/wp-json/manga/v1/load'));
  assert.equal(search.opts.method, 'POST');
  assert.deepEqual(search.opts.body, { search: 'Test Manga' });
  const feed = kit.calls.find((c) => c.url.includes('/auth/manga-chapters'));
  assert.match(feed.url, /manga_id=111111&offset=0&limit=9999&order=DESC&_t=[0-9a-f]{16}&_ts=\d+/);

  assert.equal(await mangataro.find(ctxFor({ issue: { issue_number: '999' } }), kitFor()), null);
  assert.equal(await mangataro.find(ctxFor({ seriesTitle: 'Unknown', seriesNames: ['Unknown'] }), kitFor()), null);
});

test('a Spanish-first setting changes which upload is taken', async () => {
  const found = await mangataro.find(ctxFor(), kitFor({ mangataroLanguages: 'es, en' }));
  assert.equal(found.chapterId, '900010');
  assert.equal(found.language, 'es');
});

test('resolve returns the chapter pages; a text chapter says so and is not retried', async () => {
  const kit = kitFor();
  const r = await mangataro.resolve({ chapterId: '900012' }, ctxFor(), kit);
  assert.equal(r.pages.length, 3);
  assert.equal(r.referer, 'https://mangataro.org/');
  assert.ok(kit.calls.some((c) => c.url.includes('/auth/chapter-content?chapter_id=900012')));

  const text = testKit(mangataro, { 're:/auth/chapter-content': PAGES_TEXT });
  await assert.rejects(mangataro.resolve({ chapterId: '900009' }, ctxFor(), text),
    (e) => /text, not scanned pages/.test(e.message) && e.noRetry === true);
  // A result with neither an id nor a usable link cannot be fetched.
  await assert.rejects(mangataro.resolve({ url: 'https://mangataro.org/manga/test-manga' }, ctxFor(), kitFor()), /no chapter id/);
});

test('manualSearch lists every upload of the wanted chapter, exact series first', async () => {
  const r = await mangataro.manualSearch(ctxFor(), kitFor());
  assert.deepEqual(r.searched, ['Test Manga']);
  assert.equal(r.results.length, 3, 'three uploads of chapter 12; the text chapter is not one');
  assert.ok(r.results.every((x) => x.score === 100));
  assert.match(r.results[0].meta, /Test Manga · en · New Group/);
});

test('the registered source runs on the standard build: no browser, no Cloudflare', () => {
  const src = defineSource(mangataro);
  assert.equal(src.contentKind, 'pages');
  assert.deepEqual(src.types, ['manga']);
  assert.equal(src.browser, null, 'never needs the browser build');
  assert.equal(src.card.cloudflare, false, 'and needs no FlareSolverr');
  assert.equal(src.card.unavailable, null);
  assert.deepEqual(src.card.fields.map((f) => f.key), ['mangataroUrl', 'mangataroLanguages']);
  assert.equal(src.isEnabled({ mangataroEnabled: true }), true);
  assert.equal(src.isEnabled({}), false);
});
