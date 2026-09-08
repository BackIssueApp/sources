# Changelog

Notable, user-facing changes to the download sites, newest first. Format
follows [Keep a Changelog](https://keepachangelog.com). Every site here is
updated together, so one version covers the whole set.

Contributors: please **don't** edit this file in pull requests — entries are
added by the maintainers when changes merge, so concurrent PRs don't conflict
here.

## [Unreleased]

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
- **Manual search everywhere.** From an issue's ⋯ menu, each site lists the
  uploads it has of that chapter — language, scanlation group, page count and
  release date, depending on what the site publishes — so you can take a
  different one than the automatic pick.
