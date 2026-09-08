# MangaDex (download source)

A download source for manga chapters. When an issue of a manga series is
wanted, this finds its chapter on MangaDex, downloads the pages and hands the
app a finished CBZ (or PDF, if that's your download format) for the usual
tagging and filing. Nothing external to run: no download client, no indexer.

A manga series added from the app's hosted metadata service already carries
its MangaDex identity, so a wanted chapter maps straight to the right upload
with no searching. Any other manga series is looked up by title, matched
strictly against the series' names and aliases, and its chapter chosen from
the title's feed.

## Install

One click from **Sidebar → Plugins** in BackIssue, or drop this folder into
the app's `plugins/` directory and restart. Then enable it in **Settings →
Sources → MangaDex**. Needs BackIssue 0.8.2 or newer.

## Settings

| Setting | What it does |
| --- | --- |
| **Site URL** | The API endpoint. Leave as is unless you run a mirror. |
| **Languages** | Chapter languages to accept, best first (`en`, `es`, `pt-br`, …). A chapter is taken in the first language that has it. |
| **Preferred groups** | Scanlation groups to prefer when a chapter has several uploads. Blank takes the newest upload. |
| **Data-saver images** | Download the smaller compressed pages instead of the originals. |

## How a chapter is chosen

Among the uploads of the wanted chapter number, this keeps only the readable
ones — an entry that just links to an official reader elsewhere is skipped —
and then prefers, in order: your first language, your preferred groups, the
newest upload. A manual search from an issue's ⋯ menu lists every matching
upload with its group, language and page count, so you can pick a different
one yourself.

## Built on the source toolkit

The whole source is one description of the site (`source.js`): how to search
it, how to pick a chapter, and where a chapter's page images are. Everything
else — HTTP with browser-like headers, per-site request pacing, page
downloads, building the file, the settings card and its Test button — comes
from the app's site-source toolkit. It's a useful reference for writing
another site source.

## Tests

`npm test` — network-free, driven by recorded API answers.

## License

GPL-3.0-or-later.
