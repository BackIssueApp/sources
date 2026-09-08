# BackIssue download sources

The sites BackIssue can download from, kept together in one repository rather
than one plugin each. Each folder here is a single site.

## Install

Each site installs on its own from **Sidebar → Plugins → Download sites** in
BackIssue, the same way a plugin does: the app reads `catalog.json` from here
and fetches that site's bundle from the latest release.

To install by hand, drop a site's folder into your install's `sources/`
directory and restart. Docker installs mount their data directory, so put it in
the data directory's `sources/` folder, or set `SOURCES_DIR` to wherever you
keep it. Cloning this whole repository as `sources/` works too, and then a
`git pull` updates every site at once.

Each site is switched on and set up in **Settings → Sources**.

## What's here

| Site | Content | Needs |
| --- | --- | --- |
| `atsumaru` | Manga chapters | Nothing — plain requests |
| `getcomics` | Comics, single issues and packs | FlareSolverr (the site is behind Cloudflare) |
| `mangadex` | Manga chapters | Nothing — plain requests |
| `mangataro` | Manga chapters | Nothing — plain requests |
| `weebcentral` | Manga chapters | FlareSolverr (the site is behind Cloudflare) |

Each folder holds `index.js` (registration), `source.js` (the site's own
knowledge), a `package.json` naming its version, a `README.md` and network-free
tests. `catalog.json` at the root is what the app reads to offer them.

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

## Releasing

Tag a version and push it; the workflow packs one zip per site, attaches them to
the release, and takes the notes from this changelog. Bump the version in the
site's `package.json` and in `catalog.json` so the app can tell an update is
available.

## Requirements

BackIssue 0.8.2 or newer, which is the release that added the source toolkit.

## License

GPL-3.0-or-later.
