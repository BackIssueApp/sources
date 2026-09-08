// The MangaTaro download source, described for the app's site-source toolkit.
// A "pages" source: a chapter is a list of image URLs, and the toolkit builds
// the file. Plain HTTP throughout — no Cloudflare, no browser, no account.
//
// Three calls make a download:
//   POST /wp-json/manga/v1/load        — search, returns catalogue rows
//   GET  /auth/manga-chapters          — every chapter of one title
//   GET  /auth/chapter-content         — the page images of one chapter
//
// The chapter-list call carries a short signature the site's own client
// computes from the current time: the first 16 characters of the MD5 of
// "<unix seconds>mng_ch_<UTC yyyyMMddHH>", sent as `_t` alongside `_ts`.
// It is not authentication (no account is involved, and the pages call needs
// nothing at all); it only pins a request to the hour it was made, so this
// recreates it the same way the site's page does.
import crypto from 'node:crypto';

const SITE = 'https://mangataro.org';

/** The `_t` signature for a request made at `ts` (unix seconds). */
export function signature(ts, now = new Date(ts * 1000)) {
  const hour = now.toISOString().slice(0, 13).replace(/[-T]/g, ''); // yyyyMMddHH, UTC
  return crypto.createHash('md5').update(`${ts}mng_ch_${hour}`).digest('hex').slice(0, 16);
}

/** The trailing id in /read/<slug>/ch12-494786 — what the pages call wants. */
export const chapterIdFrom = (url) => (/-(\d+)\/?$/.exec(String(url || '')) || [])[1] || null;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const langsOf = (kit) => {
  const raw = String(kit.settings?.mangataroLanguages || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return raw.length ? raw : ['en'];
};

/** A catalogue row → the shape the toolkit's matcher understands. Novels are
 *  dropped: they are prose, not page images, so nothing here can read them. */
export function parseSearchRows(data) {
  const rows = Array.isArray(data) ? data : (data?.data || data?.items || []);
  return rows
    .filter((r) => r && r.url && String(r.type || '').toLowerCase() !== 'novel')
    .map((r) => ({
      mangaId: String(r.id),
      title: clean(r.title),
      url: r.url,
      year: r.year ? String(r.year) : null,
      status: r.status || null,
      kind: r.type || null,
      cover: r.cover || null,
    }));
}

/** The chapter feed → [{ id, number, title, url, language, group, date }]. */
export function parseChapters(data) {
  const rows = data?.chapters || data?.data || (Array.isArray(data) ? data : []);
  const placeholder = (v) => !v || ['n/a', '—', '-'].includes(String(v).trim().toLowerCase());
  return rows.filter((c) => c && c.url).map((c) => ({
    id: String(c.id),
    number: c.chapter != null ? String(c.chapter) : null,
    title: placeholder(c.title) ? null : clean(c.title),
    url: c.url,
    language: String(c.language || '').toLowerCase(),
    group: placeholder(c.group_name) ? null : clean(c.group_name),
    date: c.date || null,
    text: String(c.chapter_type || '').toLowerCase() === 'text',
  }));
}

/** The title whose name IS one of the volume's names — strict, so a search for
 *  "Solo Leveling" never grabs "Solo Leveling: Arise". */
export function pickTitle(rows, names, kit) {
  const norm = kit.match.normalizeSeries;
  const accepted = names.map(norm).filter(Boolean);
  return rows.find((r) => accepted.includes(norm(r.title))) || null;
}

/** The chapter to download: the wanted number, in the best language available,
 *  newest upload first when a number appears more than once. */
export function chooseChapter(chapters, number, languages, kit) {
  const want = kit.match.normalizeNumber(number);
  const rank = (l) => { const i = languages.indexOf(String(l || '').toLowerCase()); return i === -1 ? languages.length : i; };
  const usable = chapters.filter((c) => !c.text && (want === '' || (c.number != null && kit.match.normalizeNumber(c.number) === want)));
  usable.sort((a, b) => rank(a.language) - rank(b.language) || Number(b.id) - Number(a.id));
  return usable[0] || null;
}

async function searchTitles(query, kit) {
  const data = await kit.http.json(`${kit.siteUrl}/wp-json/manga/v1/load`, {
    method: 'POST', body: { search: query },
    headers: { referer: `${SITE}/`, 'x-requested-with': 'XMLHttpRequest' },
  });
  return parseSearchRows(data);
}

async function chaptersOf(mangaId, kit) {
  const ts = Math.floor(Date.now() / 1000);
  const qs = new URLSearchParams({ manga_id: String(mangaId), offset: '0', limit: '9999', order: 'DESC', _t: signature(ts), _ts: String(ts) });
  const data = await kit.http.json(`${kit.siteUrl}/auth/manga-chapters?${qs}`, {
    headers: { referer: `${SITE}/`, 'x-requested-with': 'XMLHttpRequest' },
  });
  return parseChapters(data);
}

const candidateFor = (ch, title) => ({
  chapterId: ch.id, url: ch.url, number: ch.number,
  title: `${title} Chapter ${ch.number ?? '?'}${ch.title ? `: ${ch.title}` : ''}`,
  language: ch.language, group: ch.group,
});

export const mangataro = {
  id: 'mangataro',
  label: 'MangaTaro',
  description: 'Manga chapters from MangaTaro. Downloads the pages of a chapter and builds the file — no download client, and no account needed.',
  baseUrl: SITE,
  urlNote: 'The site URL. Change it only if the site moves.',
  kind: 'pages',
  types: ['manga'],
  rateMs: 800,
  pageRateMs: 200,     // the images come from the site's own image host
  pageConcurrency: 3,
  testQuery: 'solo leveling',
  settings: {
    mangataroLanguages: { type: 'string', label: 'Languages', placeholder: 'en', default: 'en', note: 'Chapter languages to accept, best first, comma-separated.' },
  },

  async search(query, ctx, kit) {
    return searchTitles(query, kit);
  },

  async find(ctx, kit) {
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    let hit = null;
    // Search under a few names, but match against every one the volume has.
    for (const name of kit.searchNames(ctx)) {
      hit = pickTitle(await searchTitles(name, kit), names, kit);
      if (hit) break;
    }
    if (!hit) return null;
    const ch = chooseChapter(await chaptersOf(hit.mangaId, kit), ctx.issue?.issue_number, langsOf(kit), kit);
    return ch ? candidateFor(ch, hit.title) : null;
  },

  async resolve(candidate, ctx, kit) {
    const id = candidate.chapterId || chapterIdFrom(candidate.url);
    if (!id) throw Object.assign(new Error('MangaTaro: this result has no chapter id'), { noRetry: true });
    const data = await kit.http.json(`${kit.siteUrl}/auth/chapter-content?chapter_id=${encodeURIComponent(id)}`, {
      headers: { referer: `${SITE}/`, 'x-requested-with': 'XMLHttpRequest' },
    });
    const pages = (data?.images || []).filter((u) => typeof u === 'string' && /^https?:/.test(u));
    if (!pages.length) {
      // A text chapter is prose, not scans: nothing here can turn it into a comic.
      throw Object.assign(new Error(String(data?.chapter_type).toLowerCase() === 'text'
        ? 'this chapter is text, not scanned pages'
        : 'MangaTaro served no page images for this chapter'), { noRetry: true });
    }
    return { pages, referer: `${SITE}/` };
  },

  async manualSearch(ctx, kit) {
    const q = clean(ctx.query);
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    const want = kit.match.normalizeNumber(ctx.issue?.issue_number);
    // Every language is listed here on purpose: a manual search is where you
    // pick a specific upload, so the choice should not be narrowed for you.
    const searched = [];
    const titles = [];
    const seen = new Set();
    for (const query of (q ? [q] : kit.searchNames(ctx))) {
      searched.push(query);
      for (const t of await searchTitles(query, kit)) {
        if (!seen.has(t.mangaId)) { seen.add(t.mangaId); titles.push({ ...t, exact: !!pickTitle([t], names, kit) }); }
      }
      // The volume's own name found its series; other aliases find the same.
      if (titles.some((t) => t.exact)) break;
    }
    titles.sort((a, b) => Number(b.exact) - Number(a.exact));
    const results = [];
    for (const t of titles.slice(0, 3)) {
      const chapters = (await chaptersOf(t.mangaId, kit)).filter((c) => !c.text);
      const matching = want ? chapters.filter((c) => c.number != null && kit.match.normalizeNumber(c.number) === want) : chapters.slice(0, 40);
      for (const c of matching) {
        results.push({
          ...candidateFor(c, t.title), size: 0,
          meta: [t.title, c.language, c.group, c.date].filter(Boolean).join(' · '),
          score: want ? (t.exact ? 100 : 50) : null,
        });
      }
      if (results.length && t.exact) break;
    }
    results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return { results: results.slice(0, 100), searched };
  },
};
