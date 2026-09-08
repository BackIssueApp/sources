# MangaTaro (download source)

A download source for manga chapters. When a chapter of a manga series is
wanted, this finds it on MangaTaro, downloads the pages and hands the app a
finished CBZ (or PDF, if that's your download format) for the usual tagging
and filing.

It runs on the **standard build**: ordinary HTTP requests, no Cloudflare
helper, no browser, and no account.

## Install

One click from **Sidebar → Plugins** in BackIssue, or drop this folder into
the app's `plugins/` directory and restart. Then enable it in **Settings →
Sources → MangaTaro**. Needs BackIssue 0.8.2 or newer.

## Settings

| Setting | What it does |
| --- | --- |
| **Site URL** | The site address. Change it only if the site moves. |
| **Languages** | Chapter languages to accept, best first, comma-separated. Defaults to English. |

## How a chapter is chosen

The series is searched by title and matched strictly against the names and
aliases your library holds for it, so a side story or spin-off is never
substituted. Among the uploads of the wanted chapter number, the first
language you listed wins, then the newest upload. Text chapters — some titles
carry prose rather than scans — are skipped, because there are no pages to
build a comic from.

A manual search from an issue's ⋯ menu lists every upload of that chapter with
its language, scanlation group and release date, so you can pick a different
one.

## Built on the source toolkit

The plugin is a description of the site: how to search it, how to list a
title's chapters and where a chapter's page images are. Everything else — HTTP,
request pacing, downloading and assembling the pages, the settings card and
its Test button — comes from the app's site-source toolkit.

The site's chapter-list call carries a short signature its own pages compute
from the current hour. This reproduces it the same way. If the site changes
that scheme, chapter lookups will start failing and the signature helper in
`source.js` is the thing to update.

## Tests

`npm test` — network-free, driven by fixtures shaped like the site's answers.

## License

GPL-3.0-or-later.
