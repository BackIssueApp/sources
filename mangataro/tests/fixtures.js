// Answers shaped like the site's own: a catalogue row set (including a novel,
// which must be ignored), a chapter feed with two languages and a text
// chapter, and a chapter's image list. Titles and ids are invented.
export const M1 = '111111';
export const M2 = '222222';

export const SEARCH = [
  { id: M1, title: 'Test Manga', url: 'https://mangataro.org/manga/test-manga', cover: 'https://mangataro.org/content/media/1.jpg', status: 'Ongoing', year: '2019', type: 'Manga' },
  { id: M2, title: 'Test Manga: Side Story', url: 'https://mangataro.org/manga/test-manga-side-story', cover: null, status: 'Completed', year: '2021', type: 'Manhwa' },
  { id: '333333', title: 'Test Manga (Novel)', url: 'https://mangataro.org/manga/test-manga-novel', status: 'Ongoing', year: '2020', type: 'Novel' },
];

const ch = (id, chapter, language, extra = {}) => ({
  id, chapter, language, title: extra.title ?? null, date: extra.date || '2 days ago',
  chapter_type: extra.chapter_type || 'images', group_id: null, group_name: extra.group ?? null,
  url: `https://mangataro.org/read/test-manga/ch${chapter}-${id}`,
});

export const CHAPTERS = {
  success: true,
  total: 5,
  chapters: [
    ch('900013', '13', 'en', { title: 'N/A' }),
    ch('900012', '12', 'en', { group: 'New Group', date: '1 week ago' }),
    ch('900011', '12', 'en', { group: 'Old Group', date: '1 year ago' }),
    ch('900010', '12', 'es', { group: 'Grupo' }),
    ch('900009', '11', 'en', { chapter_type: 'text' }),
  ],
};

export const PAGES = {
  success: true,
  chapter_id: '900012',
  chapter_type: 'images',
  total: 3,
  images: [
    'https://mangataro.yachts/storage/chapters/abc123/001.webp',
    'https://mangataro.yachts/storage/chapters/abc123/002.webp',
    'https://mangataro.yachts/storage/chapters/abc123/003.webp',
  ],
};

export const PAGES_TEXT = { success: true, chapter_id: '900009', chapter_type: 'text', total: 0, images: [] };
