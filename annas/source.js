// The Anna's Archive download source, built on the app's site-source toolkit.
// An ebook source: it serves Books libraries (types: ['ebook']) and is asked
// for a book by author and title, never for a comic issue.
//
// Three pages, two ways to get a file:
//   /search?q=…&ext=epub&ext=pdf&lang=en   — the search page (HTML)
//   /dyn/api/fast_download.json?md5=…&key=… — the member API: a direct file
//                                             link, no browser check (needs
//                                             a member account's secret key)
//   /slow_download/<md5>/0/<n>              — the free route: partner server
//                                             n's wait page, which carries the
//                                             "Download now" link once the
//                                             browser check has passed
// The site sits behind DDoS-Guard, which escalates a headless browser to a
// manual captcha, so FlareSolverr cannot pass it; the app's own browser can
// (it is a real window), and once it has, its cookies carry plain requests
// for a while — the toolkit handles that: `browser: 'required'`. With a
// secret key the file comes through the API; without one it comes from the
// slow partner servers, which means a browser check per file, a slower
// transfer, and a daily limit per IP.
//
// The parser keys on structure — the `/md5/<hash>` link a result is filed
// under, the icon markers on the author line, and the "Language [xx] · EPUB ·
// 3.6MB · 2010" metadata line — not on the site's utility CSS classes.
const SITE = 'https://annas-archive.pk';
const MD5 = /\/md5\/([a-f0-9]{32})\b/i;
// What a Books library files, best first (the app's ebook handler takes these).
export const WANTED_EXTS = ['epub', 'pdf'];
const KNOWN_EXTS = 'epub|pdf|mobi|azw3?|fb2|djvu|cbz|cbr|txt|rtf|docx?|lit|chm|htmlz?|zip|rar|7z';
const UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
// How many slow partner servers to try for one file before giving up.
export const SLOW_SERVERS = 3;

export const md5Of = (url) => (MD5.exec(String(url || '')) || [])[1]?.toLowerCase() || null;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const list = (s) => String(s || '').split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
const keyOf = (kit) => String(kit.settings.annasKey || '').trim();

/** "English [en] · EPUB · 8.1MB · 2010 · 📕 Book (fiction) · …" → its parts.
 *  Any of them may be missing; the file type and size anchor the match. */
export function parseMeta(text) {
  const t = clean(text);
  const file = new RegExp(`(?:^|·)\\s*(${KNOWN_EXTS})\\s*·\\s*([\\d.]+)\\s*(B|KB|MB|GB)\\b(?:\\s*·\\s*((?:19|20)\\d{2})\\b)?`, 'i').exec(t);
  const lang = /([A-Z][A-Za-z]*(?: [A-Za-z()]+)*)\s*\[([a-z]{2,3}(?:-[a-z0-9]+)?)\]/i.exec(t);
  return {
    ext: file ? file[1].toLowerCase() : null,
    size: file ? Math.round(parseFloat(file[2]) * (UNITS[file[3].toLowerCase()] || 1)) : 0,
    year: file?.[4] || null,
    language: lang ? lang[1].trim() : null,
    lang: lang ? lang[2].toLowerCase() : null,
  };
}

/** The release-style name the app's book matcher judges: author, title,
 *  year, language and format, in the shape indexer releases use. */
export function releaseName(r) {
  const head = [r.author, r.name].filter(Boolean).join(' - ');
  return `${head}${r.year ? ` (${r.year})` : ''}${r.lang ? ` [${r.lang}]` : ''} ${String(r.ext || '').toUpperCase()}`.trim();
}

/** Search page → one row per result: { md5, url, name, author, ext, size,
 *  year, lang, title }. The "recent downloads" ticker at the top of every
 *  page links the same way and is skipped. */
export function parseSearchResults(html, kit) {
  const $ = kit.load(html);
  const out = new Map();
  $('a[href*="/md5/"]').each((_, el) => {
    const $a = $(el);
    const md5 = md5Of($a.attr('href'));
    const name = clean($a.text());
    if (!md5 || !name || out.has(md5)) return;
    if ($a.closest('.js-recent-downloads-scroll, .js-recent-downloads-container').length) return;
    // The row is the nearest ancestor that also holds the cover link (a link
    // to the same record wrapped around an image).
    let row = $a.parent();
    for (let i = 0; i < 8 && row.length; i++) {
      const cover = row.children(`a[href*="/md5/${md5}"]`).filter((__, c) => $(c).find('img').length > 0);
      if (cover.length) break;
      row = row.parent();
    }
    if (!row.length) return;
    const meta = parseMeta(row.text());
    if (!meta.ext) return; // a link in running text, not a result
    // The author line is the search link marked with the person icon; the
    // publisher/edition line with the building icon.
    const lineWith = (marker) => clean(row.find('a[href^="/search?q="]').filter((__, x) => $(x).find(`span[class*="${marker}"]`).length > 0).first().text());
    const author = lineWith('user-edit') || null;
    const edition = lineWith('company');
    const year = meta.year || ((/\b((?:19|20)\d{2})\b/.exec(edition) || [])[1] || null);
    const r = { md5, url: kit.url(`/md5/${md5}`), name, author, ext: meta.ext, size: meta.size, year, lang: meta.lang, language: meta.language, edition: edition || null };
    r.title = releaseName(r);
    out.set(md5, r);
  });
  return [...out.values()];
}

/** The member API for one file → { download_url, account_fast_download_info }.
 *  Its own error text is passed on: a bad key or an exhausted quota is
 *  final for this candidate, not something a retry fixes. */
export async function fastDownload(kit, md5) {
  const key = keyOf(kit);
  if (!key) throw Object.assign(new Error("Anna's Archive: no secret key set"), { noRetry: true });
  const url = `${kit.siteUrl}/dyn/api/fast_download.json?md5=${encodeURIComponent(md5)}&key=${encodeURIComponent(key)}`;
  let j;
  try { j = await kit.http.json(url); }
  catch (e) {
    let msg = null;
    try { msg = JSON.parse(e?.body || '')?.error || null; } catch { /* not the API's JSON */ }
    throw Object.assign(new Error(`Anna's Archive: ${msg || e?.message || e}`), { noRetry: !!msg });
  }
  if (!j?.download_url) throw Object.assign(new Error(`Anna's Archive: ${j?.error || 'no download link for this file'}`), { noRetry: true });
  return j;
}

/** A slow partner server's wait page → { url, waitSeconds, captcha }. The
 *  file link is the one to another host that names the md5 ("Download
 *  now"); a busy server shows a wait or a captcha instead. */
export function parseSlowPage(html, md5, kit) {
  const $ = kit.load(html);
  const site = new URL(kit.siteUrl).host;
  const links = [];
  $('a[href]').each((_, a) => {
    const href = String($(a).attr('href') || '');
    if (!/^https?:/i.test(href) || !href.toLowerCase().includes(md5)) return;
    let host;
    try { host = new URL(href).host; } catch { return; }
    if (host === site) return;
    links.push({ href, text: clean($(a).text()) });
  });
  const best = links.find((l) => /download now/i.test(l.text)) || links[0];
  const text = clean($('body').text());
  const wait = /wait\s+(\d+)\s+second/i.exec(text);
  return {
    url: best?.href || null,
    waitSeconds: wait ? Number(wait[1]) : null,
    captcha: /captcha|verify (?:that )?you are (?:a )?human|too many (?:downloads|requests)/i.test(text),
  };
}

/** The free route: try the slow partner servers in turn until one gives the
 *  file link. A short wait is waited out once; a captcha or a silent page
 *  means the next server. */
export async function slowDownload(kit, md5, { servers = SLOW_SERVERS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const errors = [];
  for (let i = 0; i < servers; i++) {
    const url = `${kit.siteUrl}/slow_download/${md5}/0/${i}`;
    const opts = { waitFor: `a[href*="${md5}"]` };
    try {
      let page = parseSlowPage(await kit.http.html(url, opts), md5, kit);
      if (!page.url && page.waitSeconds && page.waitSeconds <= 120 && !page.captcha) {
        await sleep((page.waitSeconds + 2) * 1000);
        page = parseSlowPage(await kit.http.html(url, opts), md5, kit);
      }
      if (page.url) return { url: page.url, server: i + 1 };
      errors.push(`server #${i + 1} ${page.captcha ? 'asked for a captcha' : page.waitSeconds ? `asked for a ${page.waitSeconds}s wait` : 'showed no download link'}`);
    } catch (e) { errors.push(`server #${i + 1}: ${e?.message || e}`); }
  }
  throw new Error(`Anna's Archive: no slow partner server gave the file (${errors.join('; ')})`);
}

export const annas = {
  id: 'annas',
  label: "Anna's Archive",
  description: "Ebooks (EPUB and PDF) from Anna's Archive: fast downloads with a member account's secret key, the free slow partner servers without one. The site checks for a real browser, so this needs the browser build.",
  baseUrl: SITE,
  types: ['ebook'],
  browser: 'required',
  rateMs: 1500,
  // Search pages carry the search box; the interstitial does not.
  waitFor: 'input[name="q"]',
  settings: {
    annasKey: { type: 'string', secret: true, label: 'Secret key (optional)', note: 'From your account page on the site; fast downloads need a membership. Without a key, files come from the free slow partner servers: a browser check per file, a slower transfer, and a daily limit.' },
    annasLanguages: { type: 'string', label: 'Languages', default: 'en', note: 'Language codes to accept, best first (e.g. en, de). Empty = any language.' },
  },

  async search(query, _ctx, kit) {
    const langs = list(kit.settings.annasLanguages);
    const rank = (l) => { const i = langs.indexOf(l); return i === -1 ? langs.length : i; };
    const p = new URLSearchParams();
    p.set('q', query);
    for (const e of WANTED_EXTS) p.append('ext', e);
    for (const l of langs) p.append('lang', l);
    const html = await kit.http.html(`${kit.siteUrl}/search?${p.toString()}`, { waitFor: 'input[name="q"]' });
    return parseSearchResults(html, kit)
      .filter((r) => WANTED_EXTS.includes(r.ext))
      .filter((r) => !langs.length || !r.lang || langs.includes(r.lang))
      // The app ranks by its matcher; within a score, preferred language first
      // (then EPUB over PDF, then the larger file) is the order it keeps.
      .sort((a, b) => (rank(a.lang) - rank(b.lang)) || (WANTED_EXTS.indexOf(a.ext) - WANTED_EXTS.indexOf(b.ext)) || (b.size - a.size));
  },

  /** The site can label a translation with the original's language; the
   *  EPUB itself cannot. A file that says it is in a language you did not
   *  ask for is refused, and the toolkit asks for the next candidate. */
  async verify(fetched, candidate, _ctx, kit) {
    const langs = list(kit.settings.annasLanguages);
    if (!langs.length) return;
    const info = await kit.epubInfo(fetched.buffer);
    const lang = String(info?.language || '').toLowerCase().split(/[-_]/)[0];
    if (!lang) return;
    if (!langs.some((l) => l.split(/[-_]/)[0] === lang)) {
      throw new Error(`the file says it is in "${info.language}" (${info.title || candidate.name || 'untitled'}), not ${langs.join('/')} as the site listed it`);
    }
  },

  async resolve(candidate, _ctx, kit) {
    const md5 = candidate.md5 || md5Of(candidate.url);
    const label = candidate.name || candidate.title || md5;
    if (keyOf(kit)) {
      const j = await fastDownload(kit, md5);
      const left = j.account_fast_download_info?.downloads_left;
      if (Number.isFinite(left)) kit.log.info(`${left} fast download(s) left today after "${label}"`);
      return { url: j.download_url, referer: `${kit.siteUrl}/` };
    }
    const r = await slowDownload(kit, md5);
    kit.log.info(`"${label}" from slow partner server #${r.server} (no secret key set, so no fast download)`);
    return { url: r.url, referer: `${kit.siteUrl}/` };
  },

  /** The Test button: with a key, is it accepted? Without one, does the site
   *  answer at all? Both ask the API about a file that does not exist, so a
   *  good key is confirmed without spending a download. */
  async test(kit) {
    const key = keyOf(kit);
    const probe = async (k) => {
      try { await fastDownload({ ...kit, settings: { ...kit.settings, annasKey: k } }, '0'.repeat(32)); return 'ok'; }
      catch (e) { return String(e?.message || e).replace(/^Anna's Archive: /, ''); }
    };
    if (!key) {
      const r = await probe('none');
      if (!/secret key/i.test(r)) return { ok: false, message: `The site did not answer as expected (${r}).` };
      return { ok: true, message: 'Reachable. No secret key set, so files come from the free slow partner servers — a browser check per file, a slower transfer, and a daily limit. A member key turns on fast downloads.' };
    }
    const r = await probe(key);
    if (/secret key|membership|member/i.test(r)) return { ok: false, message: r };
    // Any other answer came from behind the key check. "Record not found"
    // is the expected one for the made-up md5; anything else is shown.
    if (r === 'ok' || /not found/i.test(r)) return { ok: true, message: 'Connected — the secret key is accepted.' };
    return { ok: true, message: `Connected — the secret key is accepted (${r}).` };
  },
};
