// Network-free: the toolkit's testKit serves recorded API answers, so find,
// resolve and manualSearch run exactly as in production minus the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSource, testKit } from '../../../src/sourcekit/index.js';
import { mangadex, titleUuid, chapterUuid, pickTitle, chooseChapter, pagesFrom, chapterRow, titleRow } from '../source.js';
import { SEARCH, FEED, AT_HOME, T1, T2, CH_EN_A, CH_EN_B, CH_ES, CH_13 } from './fixtures.js';

const routes = {
  're:/manga\\?title=': SEARCH,
  [`/manga/${T1}/feed`]: FEED,
  [`/manga/${T2}/feed`]: { data: [], total: 0 },
  're:/at-home/server/': AT_HOME,
};
const kitFor = (config = {}, ctx = {}) => testKit(mangadex, routes, { config, ctx });
const ctxFor = (extra = {}) => ({ series: { type: 'manga' }, seriesTitle: 'Berserk', seriesNames: ['Berserk'], issue: { issue_number: '12', url: 'cvissue:900000012' }, cv: null, ...extra });

test('ids are read from MangaDex site links', () => {
  assert.equal(titleUuid(`https://mangadex.org/title/${T1}`), T1);
  assert.equal(titleUuid('https://comicvine.gamespot.com/x/4050-1'), null);
  assert.equal(chapterUuid(`https://mangadex.org/chapter/${CH_EN_A}`), CH_EN_A);
  assert.equal(chapterUuid(null), null);
});

test('pickTitle is strict: the series name or an alt title, never a prefix match', () => {
  const kit = kitFor();
  const rows = SEARCH.data.map(titleRow);
  assert.equal(pickTitle(rows, ['Berserk'], kit)?.mangaId, T1, 'exact title beats the earlier "Berserk of Gluttony" hit');
  assert.equal(pickTitle(rows, ['Berserk Deluxe'], kit)?.mangaId, T1, 'alt titles count');
  assert.equal(pickTitle(rows, ['Berserk of'], kit), null);
});

test('chooseChapter honours number, language order, preferred groups, then the newest upload', () => {
  const kit = kitFor();
  const chapters = FEED.data.map(chapterRow);
  assert.equal(chooseChapter(chapters, '12', { languages: ['en'] }, kit).id, CH_EN_B, 'newest English upload');
  assert.equal(chooseChapter(chapters, '12', { languages: ['en'], groups: ['old group'] }, kit).id, CH_EN_A, 'preferred group wins');
  assert.equal(chooseChapter(chapters, '12', { languages: ['es', 'en'] }, kit).id, CH_ES, 'first language wins');
  assert.equal(chooseChapter(chapters, '012', { languages: ['en'] }, kit).id, CH_EN_B, 'numbers are normalised');
  assert.equal(chooseChapter(chapters, '13', { languages: ['en'] }, kit).id, CH_13);
  assert.equal(chooseChapter(chapters, '99', { languages: ['en'] }, kit), null);
  assert.ok(!chapters.filter((c) => c.number === '12').map((c) => chooseChapter([c], '12', {}, kit)).some((c) => c?.external), 'external-only chapters are never chosen');
});

test('pagesFrom builds MangaDex@Home URLs, data-saver when asked', () => {
  assert.deepEqual(pagesFrom(AT_HOME), ['https://uploads.mangadex.org/data/abc123/1-full.png', 'https://uploads.mangadex.org/data/abc123/2-full.jpg']);
  assert.deepEqual(pagesFrom(AT_HOME, true), ['https://uploads.mangadex.org/data-saver/abc123/1-small.jpg', 'https://uploads.mangadex.org/data-saver/abc123/2-small.jpg']);
  assert.deepEqual(pagesFrom({ baseUrl: 'x', chapter: { hash: 'h', data: [] } }), []);
});

test('find: a title known from the metadata service goes straight to its feed and picks the chapter', async () => {
  const kit = kitFor({}, ctxFor({ cv: { site_detail_url: `https://mangadex.org/title/${T1}` } }));
  const found = await mangadex.find(ctxFor({ cv: { site_detail_url: `https://mangadex.org/title/${T1}` } }), kit);
  assert.equal(found.chapterId, CH_EN_B);
  assert.equal(found.title, 'Berserk Ch. 12 — The Black Swordsman [New Group]');
  assert.equal(found.url, `https://mangadex.org/chapter/${CH_EN_B}`);
  assert.ok(!kit.calls.some((c) => /manga\?title=/.test(c.url)), 'no title search was needed');
});

test('find: an unknown title is searched and matched strictly; languages and groups come from settings', async () => {
  let kit = kitFor({ mangadexLanguages: 'es, en', mangadexGroups: 'grupo' });
  let found = await mangadex.find(ctxFor(), kit);
  assert.equal(found.chapterId, CH_ES);
  assert.ok(kit.calls.some((c) => /manga\?title=Berserk/.test(c.url)));
  assert.ok(kit.calls.some((c) => c.url.includes(`/manga/${T1}/feed`) && c.url.includes('translatedLanguage[]=es') && c.url.includes('translatedLanguage[]=en')));

  kit = kitFor();
  found = await mangadex.find(ctxFor({ seriesTitle: 'Nonexistent Manga', seriesNames: ['Nonexistent Manga'] }), kit);
  assert.equal(found, null, 'a search hit that is not this series is never taken');
});

test('resolve lists the chapter pages; the registered source turns them into a candidate + settings card', async () => {
  const kit = kitFor({ mangadexDataSaver: true });
  const r = await mangadex.resolve({ chapterId: CH_EN_B }, ctxFor(), kit);
  assert.equal(r.pages.length, 2);
  assert.match(r.pages[0], /data-saver/);
  // The @Home nodes 404 some pages without it (seen live, 2026-09-08).
  assert.equal(r.referer, 'https://mangadex.org/');
  await assert.rejects(mangadex.resolve({ chapterId: 'x' }, ctxFor(), testKit(mangadex, { 're:/at-home/server/': { baseUrl: 'x', chapter: { hash: 'h', data: [] } } })), /no pages/);

  const src = defineSource(mangadex);
  assert.equal(src.kind, 'immediate');
  assert.equal(src.contentKind, 'pages');
  assert.deepEqual(src.types, ['manga']);
  assert.equal(src.isEnabled({ mangadexEnabled: true }), true);
  assert.deepEqual(src.card.fields.map((f) => f.key), ['mangadexUrl', 'mangadexLanguages', 'mangadexGroups', 'mangadexDataSaver']);
  assert.equal(src.settingsFields.mangadexDataSaver.type, 'bool');
  assert.equal(await src.find({ ...ctxFor(), series: { type: 'comic' } }), null, 'manga libraries only');
});

test('manualSearch lists matching chapters across the top titles, exact series first', async () => {
  const kit = kitFor();
  const r = await mangadex.manualSearch(ctxFor(), kit);
  assert.deepEqual(r.searched, ['Berserk']);
  assert.equal(r.results.length, 3, 'three readable English chapter 12 uploads (the external one is skipped)');
  assert.ok(r.results.every((x) => x.chapterId && x.url.startsWith('https://mangadex.org/chapter/')));
  assert.equal(r.results[0].score, 100);
  assert.match(r.results[0].meta, /20 pages · (New|Old) Group · en/);
  const free = await mangadex.manualSearch(ctxFor({ query: 'berserk', issue: {} }), kit);
  assert.ok(free.results.length >= 4, 'no number → the latest chapters of each title');
  assert.equal(free.results[0].score, null);
});
