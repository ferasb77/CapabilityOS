/**
 * Fetches Cairo Regular + Bold as raw TTF bytes from the Google Fonts CDN at
 * certificate-generation time — no npm font package, per the Sprint 27
 * brief — and caches the result in memory for the lifetime of this server
 * process so repeat certificate generations don't re-fetch.
 *
 * Two details make this trickier than a plain fetch:
 *   1. Google's CSS2 endpoint serves WOFF2 to modern browsers. pdf-lib's
 *      fontkit only parses TTF/OTF, so the request spoofs a legacy
 *      User-Agent that Google Fonts still serves .ttf to.
 *   2. Cairo (like every Google Font with non-Latin support) is split into
 *      multiple @font-face blocks by Unicode subset — the CSS response's
 *      "latin" block has no Arabic glyphs at all. Each block is preceded by
 *      a `/* <subset> *\/` comment, so the "arabic" block specifically has
 *      to be picked out rather than just grabbing the first `url(...)`.
 */

const LEGACY_USER_AGENT =
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.34 (KHTML, like Gecko) PhantomJS/1.9.7 Safari/534.34";

export type CairoFontBytes = { regular: ArrayBuffer; bold: ArrayBuffer };

async function fetchCairoArabicTtfUrl(weight: 400 | 700): Promise<string | null> {
  try {
    const response = await fetch(`https://fonts.googleapis.com/css2?family=Cairo:wght@${weight}&display=swap`, {
      headers: { "User-Agent": LEGACY_USER_AGENT },
    });

    if (!response.ok) {
      return null;
    }

    const css = await response.text();
    const blocks = css.split("/*").slice(1);

    for (const block of blocks) {
      if (!block.trimStart().toLowerCase().startsWith("arabic")) {
        continue;
      }
      const match = block.match(/url\((https:[^)]+\.ttf)\)/);
      if (match) {
        return match[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchCairoArabicTtfBytes(weight: 400 | 700): Promise<ArrayBuffer | null> {
  const url = await fetchCairoArabicTtfUrl(weight);
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

let cachedFontsPromise: Promise<CairoFontBytes | null> | null = null;

/**
 * Returns `null` (never throws) when the CDN is unreachable or the response
 * shape changes — callers fall back to a standard PDF font, which renders
 * Arabic text as missing-glyph boxes rather than failing certificate
 * generation outright.
 */
export function getCairoFontBytes(): Promise<CairoFontBytes | null> {
  if (!cachedFontsPromise) {
    cachedFontsPromise = Promise.all([fetchCairoArabicTtfBytes(400), fetchCairoArabicTtfBytes(700)])
      .then(([regular, bold]) => (regular && bold ? { regular, bold } : null))
      .catch(() => null);
  }

  return cachedFontsPromise;
}
