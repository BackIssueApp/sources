// The MangaDex download source, built on the app's site-source toolkit
// (api.defineSource). A "pages" source: a chapter is a list of page images
// from MangaDex@Home, and the toolkit assembles the CBZ.
//
// Two ways to reach a chapter. A manga cataloged from the hosted metadata
// service already carries its MangaDex ids (the series' site link names the
// title, the chapter's site link names the chapter), so the wanted issue maps
// straight to a chapter with no searching. Anything else is searched by
// title and matched strictly, then the chapter is chosen from the title's
// feed by number, preferred language and preferred scanlation group.
//
// Everything here is pure or kit-driven so it runs offline in tests.
const RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic']; // no filtering — the app has its own mature handling
const SITE = 'https://mangadex.org';

export const titleUuid = (url) => (/mangadex\.org\/title\/([0-9a-f-]{36})/i.exec(String(url || '')) || [])[1] || null;
export const chapterUuid = (url) => (/mangadex\.org\/chapter\/([0-9a-f-]{36})/i.exec(String(url || '')) || [])[1] || null;

const list = (s, fallback) => {
  const out = String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return out.length ? out : fallback;
};
export const languagesOf = (kit) => list(kit.settings?.mangadexLanguages, ['en']);
export const groupsOf = (kit) => list(kit.settings?.mangadexGroups, []);

const ratingQs = RATINGS.map((r) => `contentRating[]=${r}`).join('&');

/** One search result → { mangaId, title, altTitles, year, url }. */
export function titleRow(m) {
  const a = m?.attributes || {};
  const t = a.title || {};
  const title = t.en || Object.values(t)[0] || '';
  const altTitles = (a.altTitles || []).flatMap((o) => Object.values(o || {}));
  return { mangaId: m.id, title, altTitles, year: a.year || null, url: `${SITE}/title/${m.id}` };
}

/** One feed entry → the chapter shape chooseChapter works on. */
export function chapterRow(c) {
  const a = c?.attributes || {};
  const group = (c?.relationships || []).find((r) => r.type === 'scanlation_group')?.attributes?.name || null;
  return {
    id: c.id, number: a.chapter ?? null, volume: a.volume ?? null, title: a.title || null,
    language: String(a.translatedLanguage || '').toLowerCase(), pages: Number(a.pages) || 0,
    publishAt: a.publishAt || null, external: !!a.externalUrl, group,
  };
}

/** The title whose name or alt title IS one of the series' names — strict, so
 *  a search for "Berserk" never grabs "Berserk of Gluttony". */
export function pickTitle(rows, names, kit) {
  const norm = kit.match.normalizeSeries;
  const accepted = names.map(norm).filter(Boolean);
  return rows.find((r) => accepted.includes(norm(r.title)) || r.altTitles.some((t) => accepted.includes(norm(t)))) || null;
}

/** The chapter to download for a number: readable (not external-only, has
 *  pages), matching the number, best language first, preferred groups first,
 *  then the newest upload. No number → the first readable chapter. */
export function chooseChapter(chapters, number, { languages = ['en'], groups = [] } = {}, kit) {
  const want = kit.match.normalizeNumber(number);
  const rank = (arr, v) => { const i = arr.indexOf(String(v || '').toLowerCase()); return i === -1 ? arr.length : i; };
  const cands = chapters
    .filter((c) => !c.external && c.pages > 0)
    .filter((c) => want === '' || kit.match.normalizeNumber(c.number) === want)
    .sort((a, b) => rank(languages, a.language) - rank(languages, b.language)
      || rank(groups, a.group) - rank(groups, b.group)
      || String(b.publishAt || '').localeCompare(String(a.publishAt || '')));
  return cands[0] || null;
}

/** MangaDex@Home answer → page URLs. */
export function pagesFrom(atHome, dataSaver = false) {
  const ch = atHome?.chapter || {};
  const files = (dataSaver && ch.dataSaver?.length ? ch.dataSaver : ch.data) || [];
  const mode = dataSaver && ch.dataSaver?.length ? 'data-saver' : 'data';
  return files.map((f) => `${String(atHome.baseUrl || '').replace(/\/+$/, '')}/${mode}/${ch.hash}/${f}`);
}

async function searchTitles(query, kit, limit = 10) {
  const j = await kit.http.json(`${kit.siteUrl}/manga?title=${encodeURIComponent(query)}&limit=${limit}&${ratingQs}&order[relevance]=desc`);
  return (j?.data || []).map(titleRow);
}

async function feed(mangaId, languages, kit) {
  const out = [];
  const langQs = languages.map((l) => `translatedLanguage[]=${encodeURIComponent(l)}`).join('&');
  for (let offset = 0, total = Infinity; offset < total && offset < 5000; offset += 500) {
    const j = await kit.http.json(`${kit.siteUrl}/manga/${mangaId}/feed?limit=500&offset=${offset}&${langQs}&${ratingQs}&order[chapter]=asc&includes[]=scanlation_group`);
    for (const c of (j?.data || [])) out.push(chapterRow(c));
    total = Number(j?.total) || 0;
  }
  return out;
}

const candidateFor = (ch, seriesTitle) => ({
  chapterId: ch.id,
  title: `${seriesTitle} Ch. ${ch.number ?? '?'}${ch.title ? ` — ${ch.title}` : ''}${ch.group ? ` [${ch.group}]` : ''}`,
  url: `${SITE}/chapter/${ch.id}`,
  group: ch.group, language: ch.language, pages: ch.pages, number: ch.number,
});

export const mangadex = {
  id: 'mangadex',
  label: 'MangaDex',
  description: 'Manga chapters from MangaDex. Downloads the pages of a chapter and builds the file; series from the hosted metadata service map straight to their chapters.',
  baseUrl: 'https://api.mangadex.org',
  urlNote: 'The MangaDex API endpoint. Leave as is unless you run a mirror.',
  kind: 'pages',
  types: ['manga'],
  rateMs: 250,        // MangaDex allows 5 requests a second
  pageRateMs: 0,      // page images come from MangaDex@Home nodes, not the API
  pageConcurrency: 3,
  testQuery: 'one piece',
  settings: {
    mangadexLanguages: { type: 'string', label: 'Languages', placeholder: 'en', default: 'en', note: 'Chapter languages to accept, best first, comma-separated (en, es, pt-br, …).' },
    mangadexGroups: { type: 'string', label: 'Preferred groups', placeholder: '', note: 'Scanlation groups to prefer when a chapter has several uploads, comma-separated. Blank = the newest upload.' },
    mangadexDataSaver: { type: 'bool', label: 'Data-saver images', note: 'Download the smaller compressed pages instead of the originals.' },
  },

  // Titles, for the Test button (and anything that wants raw title search).
  async search(query, ctx, kit) {
    return searchTitles(query, kit);
  },

  async find(ctx, kit) {
    const languages = languagesOf(kit);
    const groups = groupsOf(kit);
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    let mangaId = titleUuid(ctx.cv?.site_detail_url);
    // A chapter cataloged from the metadata service names itself.
    if (mangaId) {
      let detail = null;
      try { detail = await kit.issueDetail(); } catch { /* fall back to the feed */ }
      const chapterId = chapterUuid(detail?.site_detail_url);
      if (chapterId) return { chapterId, title: `${ctx.seriesTitle} Ch. ${ctx.issue?.issue_number ?? '?'}`, url: `${SITE}/chapter/${chapterId}`, number: ctx.issue?.issue_number };
    }
    if (!mangaId) {
      // Search under a few names, match against all of them (see kit.searchNames).
      for (const name of kit.searchNames(ctx)) {
        const hit = pickTitle(await searchTitles(name, kit), names, kit);
        if (hit) { mangaId = hit.mangaId; break; }
      }
    }
    if (!mangaId) return null;
    const ch = chooseChapter(await feed(mangaId, languages, kit), ctx.issue?.issue_number, { languages, groups }, kit);
    return ch ? candidateFor(ch, ctx.seriesTitle) : null;
  },

  async resolve(candidate, ctx, kit) {
    const atHome = await kit.http.json(`${kit.siteUrl}/at-home/server/${candidate.chapterId}`);
    const pages = pagesFrom(atHome, !!kit.settings?.mangadexDataSaver);
    if (!pages.length) throw Object.assign(new Error('MangaDex lists no pages for this chapter'), { noRetry: true });
    // The @Home image nodes hotlink-protect: without a mangadex.org referer
    // some pages answer 404 while their neighbours download fine, which looks
    // like a broken chapter rather than a missing header.
    return { pages, referer: `${SITE}/` };
  },

  async manualSearch(ctx, kit) {
    const languages = languagesOf(kit);
    const groups = groupsOf(kit);
    const q = String(ctx.query || '').trim();
    const names = [...new Set([ctx.seriesTitle, ...(ctx.seriesNames || [])].filter(Boolean))];
    const queries = q ? [q] : kit.searchNames(ctx);
    const want = kit.match.normalizeNumber(ctx.issue?.issue_number);
    const seen = new Set();
    const titles = [];
    for (const query of queries) {
      for (const t of await searchTitles(query, kit, 5)) if (!seen.has(t.mangaId)) { seen.add(t.mangaId); titles.push(t); }
      if (titles.length >= 3) break;
    }
    const results = [];
    for (const t of titles.slice(0, 3)) {
      const chapters = (await feed(t.mangaId, languages, kit)).filter((c) => !c.external && c.pages > 0);
      const matching = want ? chapters.filter((c) => kit.match.normalizeNumber(c.number) === want) : chapters.slice(-40);
      const exact = !!pickTitle([t], names, kit);
      for (const c of matching) {
        results.push({
          ...candidateFor(c, t.title), size: 0,
          meta: `${c.pages} pages · ${c.group || 'unknown group'} · ${c.language}`,
          score: want && exact ? 100 + (groups.includes(String(c.group || '').toLowerCase()) ? 10 : 0) : (want ? 50 : null),
        });
      }
    }
    results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return { results: results.slice(0, 100), searched: queries };
  },
};
