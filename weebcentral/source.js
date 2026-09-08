// The WeebCentral download source, built on the app's site-source toolkit.
// A "pages" source: a chapter is a list of page images, and the toolkit
// assembles the file.
//
// The site renders its lists through small HTMX fragment endpoints, and asking
// for those directly is both cheaper and steadier than loading the full pages:
//   /search/data?text=…            — search results
//   /series/<id>/full-chapter-list — every chapter of a series in one answer
//   /chapters/<id>/images          — the page images of one chapter
//
// It sits behind Cloudflare, so it declares `cloudflare: true` (FlareSolverr,
// which runs as its own container and keeps the app on the lean image) and
// `browser: 'fallback'` — a real browser is used only if the site challenges
// anyway and the running image happens to have one.
//
// The parsers are pure and keyed on structure (link targets, the word
// "Chapter") rather than on the site's utility CSS classes, which change often.
const SITE = 'https://weebcentral.com';
const ID = '[0-9A-Z]{20,}';

export const seriesId = (url) => (new RegExp(`/series/(${ID})`, 'i').exec(String(url || '')) || [])[1] || null;
export const chapterId = (url) => (new RegExp(`/chapters/(${ID})`, 'i').exec(String(url || '')) || [])[1] || null;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Search fragment → [{ seriesId, title, url }], one row per series. */
export function parseSearchResults(html, kit) {
  const $ = kit.load(html);
  const out = new Map();
  $(`a[href*="/series/"]`).each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    const id = seriesId(href);
    if (!id) return;
    // Each result links twice: once around the cover, once around the title.
    // The title link carries text and no image; a badge ("Official") sits in
    // the cover link, so preferring the text-only link keeps titles clean.
    const text = clean($a.text());
    const isTitleLink = !!text && $a.find('img, picture').length === 0;
    const prev = out.get(id);
    if (!prev || (isTitleLink && !prev.fromTitleLink)) {
      out.set(id, { seriesId: id, title: text || prev?.title || '', url: String(href).split('?')[0], fromTitleLink: isTitleLink });
    }
  });
  return [...out.values()].filter((r) => r.title).map(({ fromTitleLink, ...r }) => r);
}

/** Chapter-list fragment → [{ id, url, number, label, published }], newest first. */
export function parseChapterList(html, kit) {
  const $ = kit.load(html);
  return $(`a[href*="/chapters/"]`).map((_, el) => {
    const $a = $(el);
    const id = chapterId($a.attr('href'));
    if (!id) return null;
    // The link's text also carries reading state ("Last Read", a timestamp),
    // so read the number from the "Chapter N" phrase rather than the whole run.
    const text = clean($a.text());
    const m = /(?:chapter|chap\.?|ch\.?|episode|ep\.?)\s*([0-9]+(?:\.[0-9]+)?)/i.exec(text);
    return {
      id, url: `${SITE}/chapters/${id}`,
      number: m ? m[1] : null,
      label: m ? clean(m[0]) : text.slice(0, 60),
      published: $a.find('time[datetime]').attr('datetime') || null,
    };
  }).get().filter(Boolean);
}

/** Images fragment → the page URLs, in order, skipping the site's own chrome. */
export function parsePageImages(html, kit) {
  const $ = kit.load(html);
  return $('img[src]').map((_, el) => $(el).attr('src')).get()
    .filter((s) => /^https?:\/\//i.test(s) && !/\/static\//i.test(s));
}

/** The chapter whose number is the wanted one; the newest when none is asked for. */
export function chooseChapter(chapters, number, kit) {
  const want = kit.match.normalizeNumber(number);
  if (want === '') return chapters[0] || null;
  return chapters.find((c) => c.number != null && kit.match.normalizeNumber(c.number) === want) || null;
}

const searchUrl = (kit, query) => `${kit.siteUrl}/search/data?text=${encodeURIComponent(query)}&display_mode=Full+Display`;

async function searchSeries(query, kit) {
  return parseSearchResults(await kit.http.html(searchUrl(kit, query)), kit);
}

async function chaptersOf(id, kit) {
  return parseChapterList(await kit.http.html(`${kit.siteUrl}/series/${id}/full-chapter-list`), kit);
}

/** The series whose title IS one of the volume's names — strict, so a search
 *  for "Chainsaw Man" never grabs "Before Chainsaw Man". */
export function pickSeries(rows, names, kit) {
  const norm = kit.match.normalizeSeries;
  const accepted = names.map(norm).filter(Boolean);
  return rows.find((r) => accepted.includes(norm(r.title))) || null;
}

const candidateFor = (ch, title) => ({
  chapterId: ch.id, url: ch.url, number: ch.number,
  title: `${title} ${ch.label || `Ch. ${ch.number ?? '?'}`}`,
});

export const weebcentral = {
  id: 'weebcentral',
  label: 'WeebCentral',
  description: 'Manga chapters from WeebCentral. Downloads the pages of a chapter and builds the file — no download client needed.',
  baseUrl: SITE,
  urlNote: 'The site URL. Change it only if the site moves.',
  kind: 'pages',
  types: ['manga'],
  rateMs: 1500,          // a small site: keep well clear of its rate limits
  pageRateMs: 250,       // the images come from its scan host
  pageConcurrency: 2,
  cloudflare: true,      // FlareSolverr keeps this working on the lean image
  browser: 'fallback',   // a real browser only if challenged and one is present
  testQuery: 'chainsaw man',

  async search(query, ctx, kit) {
    return (await searchSeries(query, kit)).map((r) => ({ ...r, title: r.title }));
  },

  async find(ctx, kit) {
    // Match against every name the volume has, but search under only a few:
    // a manga can carry forty aliases (one per language), and a search per
    // alias is what turns one download into a minute of requests.
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    let hit = null;
    for (const name of kit.searchNames(ctx)) {
      hit = pickSeries(await searchSeries(name, kit), names, kit);
      if (hit) break;
    }
    if (!hit) return null;
    const ch = chooseChapter(await chaptersOf(hit.seriesId, kit), ctx.issue?.issue_number, kit);
    return ch ? candidateFor(ch, hit.title) : null;
  },

  async resolve(candidate, ctx, kit) {
    const url = `${kit.siteUrl}/chapters/${candidate.chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`;
    const pages = parsePageImages(await kit.http.html(url), kit);
    if (!pages.length) throw Object.assign(new Error('WeebCentral served no page images for this chapter'), { noRetry: true });
    // The scan host serves images only to readers of the site.
    return { pages, referer: `${SITE}/` };
  },

  async manualSearch(ctx, kit) {
    const q = clean(ctx.query);
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    const want = kit.match.normalizeNumber(ctx.issue?.issue_number);
    // Every request here is a round trip through Cloudflare (about a second),
    // so the work is arranged to stop as soon as the answer is in hand rather
    // than gathering everything first: search until a name matches a series
    // exactly, then read that series' chapters and stop.
    const searched = [];
    const candidates = [];
    const seen = new Set();
    for (const query of (q ? [q] : kit.searchNames(ctx))) {
      searched.push(query);
      for (const s of await searchSeries(query, kit)) {
        if (seen.has(s.seriesId)) continue;
        seen.add(s.seriesId);
        candidates.push({ ...s, exact: !!pickSeries([s], names, kit) });
      }
      // The volume's own name found its series: the other aliases are
      // translations of that same title and would only find it again.
      if (candidates.some((c) => c.exact)) break;
    }
    candidates.sort((a, b) => Number(b.exact) - Number(a.exact));
    const results = [];
    for (const s of candidates.slice(0, 3)) {
      const chapters = await chaptersOf(s.seriesId, kit);
      const matching = want ? chapters.filter((c) => c.number != null && kit.match.normalizeNumber(c.number) === want) : chapters.slice(0, 40);
      for (const c of matching) {
        results.push({
          ...candidateFor(c, s.title), size: 0,
          meta: [s.title, c.published ? c.published.slice(0, 10) : null].filter(Boolean).join(' · '),
          score: want ? (s.exact ? 100 : 50) : null,
        });
      }
      // The right series answered — the near-misses behind it are noise.
      if (results.length && s.exact) break;
    }
    results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return { results: results.slice(0, 100), searched };
  },
};
