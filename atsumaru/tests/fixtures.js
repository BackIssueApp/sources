// Answers shaped like the site's own: a search index result carrying alternate
// names, a chapter feed, and a chapter's page list with site-relative image
// paths. Titles and ids are invented.
export const M1 = 'AAAAA';
export const M2 = 'BBBBB';

const doc = (id, title, extra = {}) => ({
  document: {
    id, title, englishTitle: extra.english ?? null, otherNames: extra.others || [],
    authors: ['A. Author'], year: extra.year ?? 2019, chapterCount: extra.chapters ?? 12,
    isAdult: false, medium: 'Manga', poster: `/static/posters/${id}.webp`,
  },
});

export const SEARCH = {
  found: 2,
  page: 1,
  hits: [
    doc(M1, 'Test Manga', { others: ['Tesuto Manga'], year: 2019, chapters: 13 }),
    doc(M2, 'Test Manga: Side Story', { year: 2021, chapters: 4 }),
  ],
};

const ch = (id, number, extra = {}) => ({
  id, scanlationMangaId: 'scan1', title: extra.title ?? `Chapter ${number}`,
  number, index: number, pageCount: extra.pages ?? 20, createdAt: extra.at ?? 1_700_000_000_000, progress: null,
});

export const CHAPTERS = {
  chapters: [
    ch('c13', 13, { at: 1_800_000_000_000 }),
    ch('c12b', 12, { at: 1_790_000_000_000, pages: 22 }), // a later re-upload of 12
    ch('c12', 12, { at: 1_700_000_000_000 }),
    ch('c11', 11),
  ],
};

// Pages come back unordered on purpose: the parser must sort them.
export const PAGES = {
  readChapter: {
    id: 'c12b', title: 'Chapter 12', scanlationMangaId: 'scan1',
    pages: [
      { id: 'c12b-1', image: '/static/pages/scan1/c12b/1.webp', number: 1, width: 784, height: 1145 },
      { id: 'c12b-0', image: '/static/pages/scan1/c12b/0.webp', number: 0, width: 784, height: 1145 },
      { id: 'c12b-2', image: '/static/pages/scan1/c12b/2.webp', number: 2, width: 784, height: 1145 },
    ],
  },
};

export const PAGES_EMPTY = { readChapter: { id: 'c11', title: 'Chapter 11', pages: [] } };
