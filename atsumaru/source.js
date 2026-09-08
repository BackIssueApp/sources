// The Atsumaru download source, described for the app's site-source toolkit.
// A "pages" source: a chapter is a list of image URLs, and the toolkit builds
// the file. Plain HTTP throughout — no Cloudflare, no browser, no account.
//
// Three calls make a download:
//   GET /collections/manga/documents/search — the site's search index
//   GET /api/manga/allChapters?mangaId=     — every chapter of one title
//   GET /api/read/chapter?mangaId=&chapterId= — one chapter's pages
//
// A page's `image` is a site-relative path, so it is resolved against the
// site URL rather than assumed to be absolute.
const SITE = 'https://atsu.moe';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** A search hit → { mangaId, title, names, year, chapters }. `names` carries
 *  the site's own alternates, so a volume known by another name still matches. */
export function parseHit(hit) {
  const d = hit?.document || hit || {};
  const names = [d.title, d.englishTitle, ...(Array.isArray(d.otherNames) ? d.otherNames : [])].filter(Boolean).map(clean);
  return {
    mangaId: d.id,
    title: clean(d.title || d.englishTitle || ''),
    names,
    year: d.year ? String(d.year) : (d.startYear ? String(d.startYear) : null),
    chapters: Number(d.chapterCount) || null,
    adult: !!d.isAdult,
  };
}

export function parseSearch(data) {
  return (data?.hits || []).map(parseHit).filter((r) => r.mangaId && r.title);
}

/** The chapter feed → [{ id, number, title, pages }], newest first. */
export function parseChapters(data) {
  const rows = data?.chapters || (Array.isArray(data) ? data : []);
  return rows.filter((c) => c && c.id).map((c) => ({
    id: String(c.id),
    number: c.number != null ? String(c.number) : null,
    title: clean(c.title) || null,
    pages: Number(c.pageCount) || 0,
    at: Number(c.createdAt) || 0,
  }));
}

/** A chapter's pages → absolute image URLs in reading order. */
export function parsePages(data, siteUrl = SITE) {
  const pages = data?.readChapter?.pages || data?.pages || [];
  return [...pages]
    .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
    .map((p) => {
      const img = String(p?.image || '');
      if (!img) return null;
      return /^https?:/i.test(img) ? img : `${siteUrl}/${img.replace(/^\//, '')}`;
    })
    .filter(Boolean);
}

/** The title that IS one of the volume's names — checked against the site's
 *  own alternate names too, and strict, so a spin-off is never substituted. */
export function pickTitle(rows, names, kit) {
  const norm = kit.match.normalizeSeries;
  const accepted = names.map(norm).filter(Boolean);
  return rows.find((r) => r.names.some((n) => accepted.includes(norm(n)))) || null;
}

/** The wanted chapter number; the newest chapter when no number is asked for. */
export function chooseChapter(chapters, number, kit) {
  const want = kit.match.normalizeNumber(number);
  if (want === '') return [...chapters].sort((a, b) => b.at - a.at)[0] || null;
  const matches = chapters.filter((c) => c.number != null && kit.match.normalizeNumber(c.number) === want);
  // Several uploads of one number: the newest wins.
  return matches.sort((a, b) => b.at - a.at)[0] || null;
}

const H = { referer: `${SITE}/` };

async function searchTitles(query, kit, perPage = 20) {
  const qs = new URLSearchParams({
    q: query || '*',
    query_by: 'title,englishTitle,otherNames,authors',
    query_by_weights: '4,3,2,1',
    num_typos: '4,3,2,1',
    page: '1',
    per_page: String(perPage),
  });
  return parseSearch(await kit.http.json(`${kit.siteUrl}/collections/manga/documents/search?${qs}`, { headers: H }));
}

const chaptersOf = async (mangaId, kit) =>
  parseChapters(await kit.http.json(`${kit.siteUrl}/api/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`, { headers: H }));

const candidateFor = (ch, hit) => ({
  mangaId: hit.mangaId, chapterId: ch.id, number: ch.number,
  url: `${SITE}/read/${hit.mangaId}/${ch.id}`,
  title: `${hit.title} ${ch.title || `Chapter ${ch.number ?? '?'}`}`,
  pages: ch.pages,
});

export const atsumaru = {
  id: 'atsumaru',
  label: 'Atsumaru',
  description: 'Manga chapters from Atsumaru. Downloads the pages of a chapter and builds the file — no download client, and no account needed.',
  baseUrl: SITE,
  urlNote: 'The site URL. Change it only if the site moves.',
  kind: 'pages',
  types: ['manga'],
  rateMs: 600,
  pageRateMs: 150,
  pageConcurrency: 3,
  testQuery: 'chainsaw man',

  async search(query, ctx, kit) {
    return searchTitles(query, kit);
  },

  async find(ctx, kit) {
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    let hit = null;
    // Search under a few names; match against every name the volume has.
    for (const name of kit.searchNames(ctx)) {
      hit = pickTitle(await searchTitles(name, kit), names, kit);
      if (hit) break;
    }
    if (!hit) return null;
    const ch = chooseChapter(await chaptersOf(hit.mangaId, kit), ctx.issue?.issue_number, kit);
    return ch ? candidateFor(ch, hit) : null;
  },

  async resolve(candidate, ctx, kit) {
    const { mangaId, chapterId } = candidate;
    if (!mangaId || !chapterId) throw Object.assign(new Error('Atsumaru: this result has no chapter to read'), { noRetry: true });
    const data = await kit.http.json(
      `${kit.siteUrl}/api/read/chapter?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`,
      { headers: H });
    const pages = parsePages(data, kit.siteUrl);
    if (!pages.length) throw Object.assign(new Error('Atsumaru served no page images for this chapter'), { noRetry: true });
    return { pages, referer: `${SITE}/` };
  },

  async manualSearch(ctx, kit) {
    const q = clean(ctx.query);
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    const want = kit.match.normalizeNumber(ctx.issue?.issue_number);
    const searched = [];
    const titles = [];
    const seen = new Set();
    for (const query of (q ? [q] : kit.searchNames(ctx))) {
      searched.push(query);
      for (const t of await searchTitles(query, kit, 10)) {
        if (!seen.has(t.mangaId)) { seen.add(t.mangaId); titles.push({ ...t, exact: !!pickTitle([t], names, kit) }); }
      }
      // The volume's own name found its series; other aliases find the same.
      if (titles.some((t) => t.exact)) break;
    }
    titles.sort((a, b) => Number(b.exact) - Number(a.exact));
    const results = [];
    for (const t of titles.slice(0, 3)) {
      const chapters = await chaptersOf(t.mangaId, kit);
      const matching = want ? chapters.filter((c) => c.number != null && kit.match.normalizeNumber(c.number) === want) : chapters.slice(0, 40);
      for (const c of matching) {
        results.push({
          ...candidateFor(c, t), size: 0,
          meta: [t.title, c.pages ? `${c.pages} pages` : null].filter(Boolean).join(' · '),
          score: want ? (t.exact ? 100 : 50) : null,
        });
      }
      if (results.length && t.exact) break;
    }
    results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return { results: results.slice(0, 100), searched };
  },
};
