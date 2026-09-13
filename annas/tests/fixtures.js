// Representative Anna's Archive search markup for parser tests, modeled on
// the site's real structure: a "recent downloads" ticker of /md5/ links at
// the top of every page, then one row per result holding a cover link, the
// title link, the author and edition lines (marked by their icons) and the
// "Language [xx] · EXT · size · year" metadata line. Kept minimal — the parser
// keys on that structure, not on the utility classes.

const row = ({ md5, title, author, edition, meta, blurb = 'A story.' }) => `
<div class="flex pt-3 pb-3 border-b last:border-b-0 border-gray-100">
  <a href="/md5/${md5}" class="custom-a block mr-2"><div class="w-20 h-[7.5rem]"><img src="https://covers.example/${md5}.jpg" alt=""></div></a>
  <div class="max-w-full overflow-hidden flex flex-col justify-around">
    <div>
      <div class="text-[9px] text-gray-500 font-mono">upload/misc/${md5}.file</div>
      <a href="/md5/${md5}" class="js-vim-focus custom-a font-semibold text-lg">${title}</a>
      ${author ? `<a href="/search?q=${encodeURIComponent(author)}" class="block custom-a text-sm"><span class="icon-[mdi--user-edit] text-base align-sub"></span> ${author}</a>` : ''}
      ${edition ? `<a href="/search?q=" class="block custom-a text-sm"><span class="icon-[mdi--company] text-base align-sub"></span> ${edition}</a>` : ''}
    </div>
    <div>
      <div class="relative"><div class="line-clamp-[2] text-sm text-gray-600">${blurb}</div></div>
    </div>
    <div class="text-gray-800 font-semibold text-sm mt-2">${meta} · <a href="#" class="custom-a">Save</a></div>
  </div>
</div>`;

export const M_EPUB = 'a57b638f365ad09e5061a2aef9d46360';
export const M_PDF = 'b2c3d4e5f60718293a4b5c6d7e8f9012';
export const M_MOBI = 'c3d4e5f60718293a4b5c6d7e8f901234';
export const M_OTHER = 'd4e5f60718293a4b5c6d7e8f90123456';
export const M_DE = 'e5f60718293a4b5c6d7e8f9012345678';
export const M_TICKER = 'f60718293a4b5c6d7e8f901234567890';

export const SEARCH_HTML = `<!doctype html><html><head><title>the way of kings - Search</title></head><body>
<form action="/search"><input type="search" name="q" value="the way of kings"></form>
<div class="js-recent-downloads-container"><div class="w-full overflow-hidden flex js-recent-downloads-scroll">
  <span>&nbsp;•&nbsp;</span><a tabindex="-1" href="/md5/${M_TICKER}" class="inline-block truncate">Slow Heat (Heat of Love Book 1)</a>
</div></div>
<div class="js-aarecord-list-outer"> <!-- Keep in sync with below (partial results) -->
${row({ md5: M_EPUB, title: 'The Way of Kings (The Stormlight Archive #1)', author: 'Sanderson, Brandon', edition: 'The Stormlight Archive 1, 1st, 2010', meta: 'English [en] · EPUB · 8.1MB · 2010 · 📕&nbsp;Book (fiction) · 🚀/lgli/nexusstc/upload/zlib' })}
${row({ md5: M_PDF, title: 'The Way of Kings', author: 'Brandon Sanderson', edition: 'Tor Books, 2010', meta: 'English [en] · PDF · 12.4MB · 📕&nbsp;Book (fiction) · 🚀/lgli' })}
${row({ md5: M_MOBI, title: 'The Way of Kings', author: 'Brandon Sanderson', edition: '', meta: 'English [en] · MOBI · 4.3MB · 2010 · 📕&nbsp;Book (fiction)' })}
${row({ md5: M_DE, title: 'Der Weg der Könige', author: 'Brandon Sanderson', edition: 'Heyne, 2011', meta: 'German [de] · EPUB · 2.0MB · 2011 · 📕&nbsp;Book (fiction)' })}
${row({ md5: M_OTHER, title: 'Words of Radiance', author: 'Brandon Sanderson', edition: 'Tor Books, 2014', meta: 'English [en] · EPUB · 9.9MB · 2014 · 📕&nbsp;Book (fiction)' })}
</div>
<p>See also <a href="/md5/${M_TICKER}">this file</a> mentioned in running text.</p>
</body></html>`;

export const DDG_HTML = '<!doctype html><html><head><title>DDoS-Guard</title><script defer src="/.well-known/ddos-guard/js-challenge/index.js"></script></head><body data-ddg-origin="true"><h1>Checking your browser before accessing</h1></body></html>';

export const FAST_OK = { download_url: 'https://fast.example/dl/abc/The%20Way%20of%20Kings.epub', account_fast_download_info: { downloads_left: 41, downloads_per_day: 50 } };

// A slow partner server's wait page, once past the browser check: the file
// link points at a partner host and names the md5; a busy server shows a wait
// or a captcha instead.
export const PARTNER_URL = 'https://partner.example/d4/y/anon/s/1789/1000/g3/libgenrs_fiction/2260000/' + M_EPUB + '.epub~/tok/The%20Way%20of%20Kings.epub';
export const SLOW_HTML = `<!doctype html><html><head><title>Download from partner website - Anna’s Archive</title></head><body>
<a href="/md5/${M_EPUB}">back</a>
<p class="mb-4 text-sm italic">Slow Partner Server #1</p>
<p class="mb-4 text-xl font-bold"><a href="${PARTNER_URL}" target="_blank">📚 Download now</a></p>
<p class="mb-4 text-xs"><a href="https://partner.example/d4/y/anon/s/1789/1000/g3/libgenrs_fiction/2260000/${M_EPUB}.epub~/tok/annas-arch-a57b638f365a.epub" target="_blank">Download with short filename</a></p>
<p>Thanks for waiting, this keeps the website accessible for free for everyone!</p>
</body></html>`;
export const SLOW_WAIT_HTML = `<!doctype html><html><head><title>Download from partner website - Anna’s Archive</title></head><body>
<p class="mb-4 text-sm italic">Slow Partner Server #2</p>
<p>Please wait 5 seconds for the download link to appear.</p>
</body></html>`;
export const SLOW_CAPTCHA_HTML = `<!doctype html><html><head><title>Download from partner website - Anna’s Archive</title></head><body>
<p class="mb-4 text-sm italic">Slow Partner Server #3</p>
<p>Too many downloads from your IP today. Please complete the captcha to continue.</p>
</body></html>`;
