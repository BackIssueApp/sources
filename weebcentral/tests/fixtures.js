// Hand-written fragments mirroring the shape of the site's HTMX answers: the
// double link per search result (cover then title), the chapter row whose text
// also carries reading state, and the images fragment alongside site chrome.
// Titles and ids here are invented — the tests check structure, not content.
export const S1 = '01AAAAAAAAAAAAAAAAAAAAAAAA';
export const S2 = '01BBBBBBBBBBBBBBBBBBBBBBBB';
export const C12 = '01CCCCCCCCCCCCCCCCCCCCCCCC';
export const C12B = '01DDDDDDDDDDDDDDDDDDDDDDDD';
export const C13 = '01EEEEEEEEEEEEEEEEEEEEEEEE';

const result = (id, slug, title, badge = '') => `
  <article class="flex gap-4">
    <section>
      <a href="https://weebcentral.com/series/${id}/${slug}">
        ${badge ? `<span class="badge">${badge}</span>` : ''}
        <picture><source srcset="https://covers.example/${id}.webp"><img src="https://covers.example/${id}.jpg" alt="cover"></picture>
      </a>
    </section>
    <div>
      <a class="line-clamp-1 link link-hover" href="https://weebcentral.com/series/${id}/${slug}">${title}</a>
      <div><span class="opacity-60">Ongoing</span></div>
    </div>
  </article>`;

export const SEARCH_HTML = `<div id="search-results">
  ${result(S1, 'Test-Manga', 'Test Manga', 'Official')}
  ${result(S2, 'Test-Manga-Side-Story', 'Test Manga Side Story')}
</div>`;

const chapter = (id, label, when) => `
  <div x-data>
    <a href="https://weebcentral.com/chapters/${id}" class="flex items-center">
      <span class="me-2"><svg></svg></span>
      <span class="grow flex items-center gap-2">
        <span>${label}</span>
        <span class="flex gap-1 items-center link-info"><span class="hidden md:inline">Last Read</span></span>
      </span>
      <time datetime="${when}" class="opacity-60">${when}</time>
    </a>
  </div>`;

export const CHAPTERS_HTML = `<div id="chapter-list">
  ${chapter(C13, 'Chapter 13', '2026-02-02T10:00:00.000Z')}
  ${chapter(C12, 'Chapter 12', '2026-01-01T10:00:00.000Z')}
  ${chapter(C12B, 'Chapter 12.5', '2026-01-05T10:00:00.000Z')}
</div>`;

// The images fragment carries the site's own logo alongside the pages; only
// the scan host's images are pages.
export const IMAGES_HTML = `<section class="flex flex-col">
  <img src="https://weebcentral.com/static/images/brand.png" alt="logo">
  <img src="https://scans.example.us/manga/Test-Manga/0012-001.png" alt="Page 1" loading="lazy">
  <img src="https://scans.example.us/manga/Test-Manga/0012-002.png" alt="Page 2" loading="lazy">
  <img src="https://scans.example.us/manga/Test-Manga/0012-003.png" alt="Page 3" loading="lazy">
</section>`;

export const IMAGES_EMPTY = '<section><img src="https://weebcentral.com/static/images/brand.png"></section>';
