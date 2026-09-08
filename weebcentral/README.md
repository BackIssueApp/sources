# WeebCentral (download source)

A download source for manga chapters. When a chapter of a manga series is
wanted, this finds it on WeebCentral, downloads the pages and hands the app a
finished CBZ (or PDF, if that's your download format) for the usual tagging
and filing. No download client, no indexer.

## Install

One click from **Sidebar → Plugins** in BackIssue, or drop this folder into
the app's `plugins/` directory and restart. Then enable it in **Settings →
Sources → WeebCentral**. Needs BackIssue 0.8.2 or newer.

## Cloudflare, and which build you need

The site is behind Cloudflare, so a plain request is refused. Run a
**FlareSolverr** service (`ghcr.io/flaresolverr/flaresolverr`) and put its
`/v1` URL in **Settings → Downloading**, where every source that needs it
shares the one setting. That works on the **standard build** —
you do not need the browser build for this source. If you happen to run the
browser build, the source can also fall back to the built-in browser when the
site challenges anyway.

## How a chapter is found

The series is searched by title and matched strictly against the names and
aliases your library holds for it, so a similarly-named spin-off is never
substituted. The chapter is then taken from the series' own chapter list by
number, including half chapters such as 12.5. A manual search from an issue's
⋯ menu lists the matching chapter of each candidate series with its release
date, so you can pick a different one.

## Settings

| Setting | What it does |
| --- | --- |
| **Site URL** | The site address. Change it only if the site moves. |

FlareSolverr is not set here: it lives in **Settings → Downloading**, shared
by every source.

## Built on the source toolkit

The whole source is one description of the site (`source.js`): how to search
it, how to pick a chapter, and where a chapter's page images are. Everything
else — HTTP, Cloudflare handling, request pacing, page downloads, building the
file, the settings card and its Test button — comes from the app's site-source
toolkit.

Requests go to the site's own fragment endpoints rather than its full pages,
which is fewer requests for the same answers. Requests are paced so a large
backfill stays polite.

## Tests

`npm test` — network-free, driven by fragments shaped like the site's own.

## License

GPL-3.0-or-later.
