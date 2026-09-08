// Recorded shapes of the MangaDex API answers the source reads (trimmed to
// the fields it uses). Ids are stand-ins.
export const T1 = '11111111-1111-4111-8111-111111111111';
export const T2 = '22222222-2222-4222-8222-222222222222';
export const CH_EN_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const CH_EN_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const CH_ES = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const CH_EXT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const CH_13 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

export const SEARCH = {
  result: 'ok', response: 'collection',
  data: [
    { id: T2, type: 'manga', attributes: { title: { en: 'Berserk of Gluttony' }, altTitles: [], year: 2019 }, relationships: [] },
    { id: T1, type: 'manga', attributes: { title: { en: 'Berserk' }, altTitles: [{ ja: 'ベルセルク' }, { en: 'Berserk Deluxe' }], year: 1989 }, relationships: [] },
  ],
  total: 2,
};

const ch = (id, chapter, lang, group, extra = {}) => ({
  id, type: 'chapter',
  attributes: { volume: '1', chapter, title: extra.title || null, translatedLanguage: lang, pages: extra.pages ?? 20, publishAt: extra.publishAt || '2020-01-01T00:00:00+00:00', externalUrl: extra.externalUrl || null },
  relationships: group ? [{ id: 'g-' + group, type: 'scanlation_group', attributes: { name: group } }] : [],
});

export const FEED = {
  result: 'ok', response: 'collection',
  data: [
    ch(CH_EN_A, '12', 'en', 'Old Group', { publishAt: '2019-05-01T00:00:00+00:00' }),
    ch(CH_EN_B, '12', 'en', 'New Group', { publishAt: '2021-05-01T00:00:00+00:00', title: 'The Black Swordsman' }),
    ch(CH_ES, '12', 'es', 'Grupo', {}),
    ch(CH_EXT, '12', 'en', 'Official', { externalUrl: 'https://example.com/read', pages: 0 }),
    ch(CH_13, '13', 'en', 'New Group', {}),
  ],
  limit: 500, offset: 0, total: 5,
};

export const AT_HOME = {
  result: 'ok',
  baseUrl: 'https://uploads.mangadex.org',
  chapter: {
    hash: 'abc123',
    data: ['1-full.png', '2-full.jpg'],
    dataSaver: ['1-small.jpg', '2-small.jpg'],
  },
};
