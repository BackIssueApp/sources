# BackIssue download sources

The sites BackIssue can download from, kept together in one repository rather
than one plugin each. Each folder here is a single site.

## Install

Clone this repository into your BackIssue install as `sources/`:

```
git clone <this repo> /path/to/backissue/sources
```

Restart the app. The sites appear under **Download sites** on the Plugins page,
and each one is switched on and set up in **Settings → Sources**. To update
them all, pull.

Docker installs mount their data directory, so clone into the data directory's
`sources/` folder, or set `SOURCES_DIR` to wherever you keep it.

## What's here

| Site | Content | Needs |
| --- | --- | --- |
| `atsumaru` | Manga chapters | Nothing — plain requests |
| `mangadex` | Manga chapters | Nothing — plain requests |
| `mangataro` | Manga chapters | Nothing — plain requests |
| `weebcentral` | Manga chapters | FlareSolverr (the site is behind Cloudflare) |

Each folder holds `index.js` (registration), `source.js` (the site's own
knowledge), a `README.md` and network-free tests.

## How a source is written

A source describes a site; the app supplies everything else — HTTP with
Cloudflare handling, per-site request pacing, matching a result to the wanted
issue, downloading and assembling pages into a comic file, and the settings
card with its Test button. A straightforward site is a few dozen lines, and a
site whose pages are plain HTML can often be described with CSS selectors
alone.

See **Plugin API → Sources from a site description** in the BackIssue docs for
the full contract, and any folder here for a worked example.

## Tests

Tests import the app's toolkit, so run them from inside a BackIssue checkout
with this repository cloned as its `sources/` folder:

```
node --test sources/*/tests/*.test.js
```

They make no network requests: each site's answers are replayed from recorded
fixtures.

## Requirements

BackIssue 0.8.2 or newer, which is the release that added the source toolkit.

## License

GPL-3.0-or-later.
