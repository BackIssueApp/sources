# Atsumaru (download source)

A download source for manga chapters. When a chapter of a manga series is
wanted, this finds it on Atsumaru, downloads the pages and hands the app a
finished CBZ (or PDF, if that's your download format) for the usual tagging
and filing.

It runs on the **standard build**: ordinary HTTP requests, no Cloudflare
helper, no browser, and no account.

## Install

One click from **Sidebar → Plugins** in BackIssue, or drop this folder into
the app's `plugins/` directory and restart. Then enable it in **Settings →
Sources → Atsumaru**. Needs BackIssue 0.8.2 or newer.

## Settings

| Setting | What it does |
| --- | --- |
| **Site URL** | The site address. Change it only if the site moves. |

## How a chapter is chosen

The series is searched through the site's own search index and matched
strictly against the names your library holds for it, including the site's own
alternate titles, so a spin-off or side story is never substituted. When the
same chapter number has been uploaded more than once, the newest wins.

A manual search from an issue's ⋯ menu lists every upload of that chapter with
its page count, so you can pick a different one.

## Built on the source toolkit

The plugin is a description of the site: how to search it, how to list a
title's chapters and where a chapter's page images are. Everything else — HTTP,
request pacing, downloading and assembling the pages, the settings card and
its Test button — comes from the app's site-source toolkit.

Page images are given as site-relative paths and resolved against the site
URL, so pointing the setting at a mirror moves the images with it.

## Tests

`npm test` — network-free, driven by fixtures shaped like the site's answers.

## License

GPL-3.0-or-later.
