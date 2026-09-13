# Anna's Archive (download source)

A download source for **books**. When a book is wanted for a Books library
(an approved request, say), this searches Anna's Archive by author and title,
picks the best EPUB or PDF in a language you accept, fetches it through the
site's member fast-download API and hands it to the Ebooks plugin, which
files it as Author/Title and catalogs it. Comic and manga libraries never
search it.

## Install

One click from **Sidebar → Plugins → Download sites** in BackIssue, or drop
this folder into the app's `sources/` directory and restart. Then enable it in
**Settings → Sources → Anna's Archive**. Needs BackIssue 0.8.4 or newer.

## What it needs

- **The browser build of the app** (the image tagged `-browser`). The search
  page sits behind DDoS-Guard, which escalates headless browsers and
  FlareSolverr to a manual captcha; the app's own browser is a real window and
  clears it in a few seconds, after which its cookies carry ordinary requests
  for a while. On the standard build the source stays off and the card says
  so.

## With a member key, or without

- **With a member account's secret key** (from your account page on the
  site), files come through the site's fast-download API: a direct link, no
  browser check per file. The API reports how many fast downloads you have
  left today, and the log shows it after each one.
- **Without a key**, files come from the site's free **slow partner servers**:
  each file's wait page goes through the browser check, the transfer is
  slower, and the servers limit downloads per IP per day. A server that asks
  for a short wait is waited out once; one that asks for a captcha, or shows
  no link, is skipped for the next, and after three the download fails with
  what each one said.

## Settings

| Setting | Meaning |
| --- | --- |
| Site URL | The domain to use; the site moves between domains now and then, so change it here when it does. |
| Secret key (optional) | Your member key, masked on the card. Empty = the free slow partner servers. |
| Languages | Language codes to accept, best first (`en, de`). Empty accepts any language. |

**Test connection** checks the key against the API without spending a
download; with no key it checks the site answers and says the free route is
in use.

## How a book is chosen

When the request carries an ISBN (a book picked from the catalog does), the
site is asked for it first and that exact edition wins. Otherwise, or as well,
the search asks for EPUB and PDF in your languages, and every result is judged
by the app's book matcher: the title's words must all be there in order, the
author's name counts for it, and a release of the wrong kind (an audiobook) is
rejected. Among matches, your first language wins, then EPUB over PDF, then
the larger file. The site sometimes labels a translation with the original's
language, so a downloaded EPUB is checked against its own metadata: one that
says it is in a language you did not accept is refused, and the next
candidate is fetched instead.
