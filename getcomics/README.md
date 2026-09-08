# GetComics Source

An immediate direct-download source for BackIssue: single issues are fetched
in-app from GetComics — no external download client needed. Downloads come
from the Main DDL host with PixelDrain as a mirror fallback.

## Install

From **Sidebar → Plugins → Download sites** in BackIssue, or drop this folder
into your install's `sources/` directory and restart. **Needs BackIssue 0.8.2
or newer.** If you still have the old `getcomics` plugin installed, remove it:
the app uses this one and logs that the plugin copy was ignored.

## Setup

Enable it in **Settings → Sources → GetComics**:

- **Site URL** — defaults to the current domain; only change it if the site
  moves again.
- **Download proxy** (optional) — an HTTP proxy used for the file download
  only, for when the download host blocks your address while the site itself
  works.

The site sits behind Cloudflare, so set the **FlareSolverr URL** in
**Settings → Downloading**. That one setting is shared by every source that
needs it. Blank means connect directly, which works when no challenge is up.
**Test connection** tells you which path is in use.

Searches match on series title + issue number and prefer proper CBZ/CBR
releases; results import through the normal pipeline (convert, tag, file).

## Built on the source toolkit

The plugin is a description of the site: how to search it, how to read a
post's download buttons, and how its file hosts behave. Everything else —
HTTP, Cloudflare handling, request pacing, trying each mirror in turn,
checking what came back, the settings card and its Test button — comes from
the app's site-source toolkit, shared with every other source.

Multi-issue packs are unchanged: a pack post's parts are downloaded and merged
into one folder for the app to import.
