// The GetComics download source, described for the app's site-source toolkit.
//
// What is left here is only what is specific to this site: how to search it,
// how to read a post's download buttons, and how its file hosts behave. The
// HTTP, Cloudflare handling, request pacing, mirror fallback, archive checks
// and the settings card all come from the toolkit — they used to live in this
// plugin, and the toolkit's versions were derived from them.
//
// An "archive" source: a post carries a ready comic file (its own download
// server, or PixelDrain), so a grab is one file, not a page walk.
import { normalizeNumber } from '../../src/matcher.js';
import {
  parseSearchResults, parseDownloadLinks, pixeldrainDirectUrl, pixeldrainListId,
  isPackTitle, SUPPORTED_HOSTS,
} from './parse.js';
import { extractPackToDir } from './pack.js';

// Human labels for the hosts a post can offer, and what a refusal from each
// usually means — the queue's error is the only thing most people will read.
const HOST = {
  main: { label: 'GetComics', hint403: null },
  pixeldrain: { label: 'PixelDrain', hint403: 'usually its free transfer limit — try again later, or pick another mirror' },
};

const searchUrl = (kit, query) => `${kit.siteUrl}/?s=${encodeURIComponent(query)}`;

/** A post's usable download links, best first, as toolkit link objects. */
export async function postLinks(candidate, kit) {
  const all = parseDownloadLinks(await kit.http.html(candidate.postUrl || candidate.url));
  const usable = all.filter((l) => SUPPORTED_HOSTS.has(l.host));
  if (!usable.length) {
    const unsupported = [...new Set(all.map((l) => l.host))];
    // The common case: the post only offers a cloud locker, which no HTTP
    // client can download from — say which, so the message is actionable.
    throw Object.assign(new Error(unsupported.length
      ? `this post only offers ${unsupported.join('/')} — not a direct download (a GetComics or PixelDrain link is needed)`
      : `no download link found on ${candidate.postUrl || candidate.url}`), { noRetry: true });
  }
  return usable;
}

/** One parsed link → the toolkit's link shape, resolving PixelDrain's own
 *  addressing (a file link becomes a direct URL; an album is asked for its
 *  files and the comic among them is taken). */
export async function toDownloadLink(link, kit) {
  const meta = HOST[link.host] || { label: link.host, hint403: null };
  let url = link.host === 'pixeldrain' ? pixeldrainDirectUrl(link.url) : link.url;
  const listId = link.host === 'pixeldrain' ? pixeldrainListId(link.url) : null;
  if (listId) {
    const list = await kit.http.json(`https://pixeldrain.com/api/list/${listId}`);
    const files = Array.isArray(list?.files) ? list.files : [];
    const best = files.find((f) => /\.(cbz|cbr|pdf)$/i.test(f.name || ''))
      || [...files].sort((a, b) => (b.size || 0) - (a.size || 0))[0];
    if (!best?.id) throw new Error('this PixelDrain album has no downloadable file');
    url = `https://pixeldrain.com/api/file/${best.id}?download`;
  }
  return { url, label: meta.label, hint403: meta.hint403, button: link.button };
}

export const getcomics = {
  id: 'getcomics',
  label: 'GetComics',
  description: 'Direct downloads from getcomics.org. Fetches a ready comic file — no download client needed.',
  baseUrl: 'https://getcomics.org',
  urlNote: 'The site URL. The .info domain redirects here; change this only if it moves again.',
  types: ['comic'],   // a western-comics site: manga libraries never search it
  rateMs: 1000,
  cloudflare: true,   // uses the shared FlareSolverr (Settings → Downloading)
  proxy: true,        // an optional egress proxy for the file download only
  testQuery: 'batman',

  async search(query, ctx, kit) {
    // Rows carry title/url/size/year; the url IS the post page, which resolve()
    // reads for the actual download buttons. `postUrl` is kept as well because
    // the pack grab records it as the download's identity.
    const rows = parseSearchResults(await kit.http.html(searchUrl(kit, query)));
    return rows.map((r) => ({ ...r, postUrl: r.url }));
  },

  // The site indexes posts by the bare issue number ("Poison Ivy #46"), which
  // is what the toolkit's default query already builds, so nothing to add.

  async resolve(candidate, ctx, kit) {
    const links = await postLinks(candidate, kit);
    return {
      links: await Promise.all(links.map((l) => toDownloadLink(l, kit))),
      referer: candidate.postUrl || candidate.url,
    };
  },

  /** A pack post carries several archives: one download button per part on a
   *  multi-part run, plus "UPDATE" blocks as plain labelled links. The buttons
   *  are the pack — every one is downloaded and merged into a single folder.
   *  Treating them as mirrors of one file used to import a fraction of a pack. */
  async fetchPack(candidate, ctx, kit, onProgress = () => {}) {
    onProgress({ phase: 'download', unit: 'bytes', done: 0, total: 0 });
    const links = await postLinks(candidate, kit);
    const parts = links.filter((l) => l.button);
    const download = async (link, label) => {
      const l = await toDownloadLink(link, kit);
      const { buffer } = await kit.http.download(l.url, {
        referer: candidate.postUrl || candidate.url,
        onStage: (name) => onProgress({ phase: name === 'solving' ? 'solving' : 'connecting', detail: l.label + label }),
        onProgress: (p) => onProgress({ ...p, phase: 'download', unit: 'bytes', detail: l.label + label }),
      });
      return buffer;
    };
    if (!parts.length) {
      // Unusual markup with no buttons parsed: fall back to the first link.
      const { dir, count } = await extractPackToDir(await download(links[0], ''), candidate.title);
      return { dir, count };
    }
    let dir = null, count = 0, ok = 0, lastErr = null;
    for (let i = 0; i < parts.length; i++) {
      const label = parts.length > 1 ? ` (part ${i + 1}/${parts.length})` : '';
      try {
        const r = await extractPackToDir(await download(parts[i], label), `${candidate.title}${label}`, dir);
        dir = r.dir; count += r.count; ok++;
      } catch (e) {
        lastErr = e;
        console.warn(`getcomics pack: part ${i + 1}/${parts.length} failed — ${e?.message || e}`);
      }
    }
    // Every part failing is a failed grab; a partial pack still imports what
    // arrived, and the issues it missed stay wanted for a later grab.
    if (!ok) {
      throw Object.assign(new Error('getcomics pack download failed: ' + (lastErr?.message || 'all parts failed')),
        lastErr?.noRetry ? { noRetry: true } : {});
    }
    if (ok < parts.length) console.warn(`getcomics pack: imported ${ok}/${parts.length} parts — the rest failed to download`);
    return { dir, count };
  },

  /** Deliberately broad: the score is a hint here, not a filter, so packs and
   *  near-matches are offered too and the person chooses. */
  async manualSearch(ctx, kit) {
    const q = String(ctx.query || '').trim();
    // The site indexes the bare number ("Poison Ivy 46"), never the padded token.
    const num = normalizeNumber(ctx.issue?.issue_number);
    const queries = q ? [q] : kit.searchNames(ctx).map((n) => [n, /^-?\d/.test(num) ? num : ''].filter(Boolean).join(' ').trim());
    const target = kit.match.manualTarget(ctx);
    const byUrl = new Map();
    for (const query of queries.filter(Boolean)) {
      let rows;
      try { rows = parseSearchResults(await kit.http.html(searchUrl(kit, query))); }
      catch (e) { return { results: [], searched: queries, error: String(e?.message || e) }; }
      for (const r of rows) if (!byUrl.has(r.url)) byUrl.set(r.url, r);
    }
    const results = [...byUrl.values()]
      .filter((r) => !kit.match.suspiciouslySmall(r.size))
      .map((r) => {
        const pack = isPackTitle(r.title);
        return {
          source: 'getcomics', postUrl: r.url, url: r.url, title: r.title, size: r.size,
          isPack: pack, meta: pack ? 'getcomics · pack' : 'getcomics',
          score: kit.match.scoreCandidate(r, target),
        };
      });
    return { results, searched: queries };
  },
};
