# Changelog

Notable, user-facing changes to the download sites, newest first. Format
follows [Keep a Changelog](https://keepachangelog.com). Every site here is
updated together, so one version covers the whole set.

Contributors: please **don't** edit this file in pull requests — entries are
added by the maintainers when changes merge, so concurrent PRs don't conflict
here.

## [Unreleased]

## [0.2.1] — 2026-10-12

### Fixed

- **GetComics: a PixelDrain challenge page is no longer saved as the comic.**
  PixelDrain sometimes answers a download with a normal-looking web page — a
  challenge or its free-transfer rate limit — rather than an error, and that
  page was being filed as the archive and only caught at import. With a
  browser installed, GetComics now lets it clear the file host as a last
  resort (cookies only; the file still downloads as a plain request), after
  FlareSolverr has had its turn. The clearing itself needs the next BackIssue
  release; on current builds the change is harmless and the failure is at
  least named clearly.

## [0.2.0] — 2026-09-14

Needs BackIssue 0.8.4 or newer for the new site; the others are unchanged.

### Added

- **Anna's Archive.** Ebooks (EPUB and PDF) for Books libraries — an approved
  book request, for instance. Books are searched by author and title in the
  languages you accept — by ISBN first when the request has one, so the
  exact edition wins. A downloaded EPUB whose own metadata names a language
  you did not accept is refused and the next candidate tried — the site
  labels some translations with the original's language. With a member
  account's secret key the file comes
  through the site's fast-download API; without one it comes from the free
  slow partner servers (a browser check per file, slower, a daily limit).
  The site checks for a real browser (DDoS-Guard), which FlareSolverr cannot
  pass, so this one needs the browser build of the app. Needs BackIssue
  0.8.4 or newer.

## [0.1.0] — 2026-09-08

First release. Needs BackIssue 0.8.2 or newer.

### Added

- **Atsumaru.** Manga chapters over plain requests, with no account and no
  browser build needed. Series are matched against the site's own alternate
  titles as well as the names your library holds, so a series listed under a
  different title is still found. When a chapter number has been uploaded more
  than once, the newest wins.
- **MangaDex.** Manga chapters, with the chapter chosen by your accepted
  languages and preferred scanlation groups; a series added from the hosted
  metadata service maps straight to its chapters with no searching. Entries
  that only link to an official reader elsewhere are skipped, and a data-saver
  setting fetches smaller pages.
- **MangaTaro.** Manga chapters over plain requests, with no account needed.
  Chapters that are prose rather than scans are skipped, since there are no
  pages to build a comic from.
- **WeebCentral.** Manga chapters. The site is behind Cloudflare, so set the
  **FlareSolverr URL** in Settings → Downloading; the browser build is not
  required.
- **GetComics**, moved here from its own plugin and rebuilt on the app's source
  toolkit: single issues and multi-issue packs, from the site's own server with
  PixelDrain as a fallback. It is behind Cloudflare, so set the **FlareSolverr
  URL** in Settings → Downloading. Half the code it carried as a plugin is
  gone; nothing it did has been dropped. An old `getcomics` plugin install can
  be removed once this is installed.
- **Manual search everywhere.** From an issue's ⋯ menu, each site lists the
  uploads it has of that chapter — language, scanlation group, page count and
  release date, depending on what the site publishes — so you can take a
  different one than the automatic pick.
