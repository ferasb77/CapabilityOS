import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

// ---------------------------------------------------------------------------
// Layout constants — A4 portrait, same geometry as features/reports/report.ts
// and features/attendance/report.ts. Helpers duplicated rather than shared,
// matching this codebase's established per-feature-PDF-module convention
// (see features/attendance/report.ts's header comment).
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 1.5;

const SIZE = {
  coverTitle: 22,
  pageHeader: 16,
  heading: 13,
  body: 11,
  caption: 8,
};

const WHITE = rgb(1, 1, 1);
const DARK = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.45, 0.45, 0.45);
const WATERMARK_GRAY = rgb(0.6, 0.6, 0.6);

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);

  if (Number.isNaN(bigint)) {
    return rgb(0, 0, 0);
  }

  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

async function loadFonts(pdfDoc: PDFDocument): Promise<Fonts> {
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
}

function fontFor(fonts: Fonts, bold: boolean, italic: boolean): PDFFont {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

function isPng(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

async function embedLogo(pdfDoc: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  return isPng(bytes) ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
}

function formatLongDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function drawWatermark(page: PDFPage, fonts: Fonts): void {
  const text = "CONFIDENTIAL";
  const size = 64;
  const width = fonts.bold.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: PAGE_WIDTH / 2 - width / 2,
    y: PAGE_HEIGHT / 2 - size / 2,
    size,
    font: fonts.bold,
    color: WATERMARK_GRAY,
    opacity: 0.18,
    rotate: degrees(35),
  });
}

// ---------------------------------------------------------------------------
// Minimal HTML → block/run parser. The report editor's toolbar (see
// features/observations/components/report-editor.tsx) only ever produces a
// bounded vocabulary — h2, p, ul/li, and inline strong/b/em/i/br — so this
// doesn't attempt to be a general HTML parser, only to faithfully lay out
// exactly what that toolbar can generate.
// ---------------------------------------------------------------------------

type InlineRun = { text: string; bold: boolean; italic: boolean };

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseInlineRuns(html: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let bold = false;
  let italic = false;
  const tokenRegex = /<(\/?)(strong|b|em|i|br)\s*\/?>|([^<]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(html)) !== null) {
    const [, closing, tag, text] = match;

    if (text !== undefined) {
      const decoded = decodeEntities(text);
      if (decoded.trim().length > 0 || decoded.includes(" ")) {
        runs.push({ text: decoded, bold, italic });
      }
      continue;
    }

    if (tag === "br") {
      runs.push({ text: "\n", bold, italic });
      continue;
    }
    if (tag === "strong" || tag === "b") {
      bold = closing !== "/";
    }
    if (tag === "em" || tag === "i") {
      italic = closing !== "/";
    }
  }

  return runs;
}

type WordToken = { text: string; bold: boolean; italic: boolean; lineBreak?: boolean };

function runsToWordTokens(runs: InlineRun[]): WordToken[] {
  const tokens: WordToken[] = [];

  for (const run of runs) {
    if (run.text === "\n") {
      tokens.push({ text: "", bold: run.bold, italic: run.italic, lineBreak: true });
      continue;
    }

    for (const word of run.text.split(/\s+/).filter(Boolean)) {
      tokens.push({ text: word, bold: run.bold, italic: run.italic });
    }
  }

  return tokens;
}

type ContentBlock =
  | { type: "heading"; tokens: WordToken[] }
  | { type: "paragraph"; tokens: WordToken[] }
  | { type: "list"; items: WordToken[][] };

function parseContentBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const blockRegex = /<(h2|p|ul|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let matchedAny = false;

  while ((match = blockRegex.exec(html)) !== null) {
    matchedAny = true;
    const [, tag, inner] = match;

    if (tag === "ul") {
      const items: WordToken[][] = [];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRegex.exec(inner)) !== null) {
        items.push(runsToWordTokens(parseInlineRuns(liMatch[1])));
      }
      if (items.length > 0) {
        blocks.push({ type: "list", items });
      }
      continue;
    }

    const tokens = runsToWordTokens(parseInlineRuns(inner));
    if (tokens.length === 0) {
      continue;
    }

    blocks.push({ type: tag === "h2" ? "heading" : "paragraph", tokens });
  }

  if (!matchedAny) {
    const tokens = runsToWordTokens(parseInlineRuns(html));
    if (tokens.length > 0) {
      blocks.push({ type: "paragraph", tokens });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Word-wrapped, mixed-font line layout
// ---------------------------------------------------------------------------

type LaidOutLine = WordToken[];

function layoutTokensIntoLines(tokens: WordToken[], fonts: Fonts, size: number, maxWidth: number): LaidOutLine[] {
  const lines: LaidOutLine[] = [];
  let current: LaidOutLine = [];
  let currentWidth = 0;
  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", size);

  for (const token of tokens) {
    if (token.lineBreak) {
      lines.push(current);
      current = [];
      currentWidth = 0;
      continue;
    }

    const font = fontFor(fonts, token.bold, token.italic);
    const wordWidth = font.widthOfTextAtSize(token.text, size);
    const addedWidth = current.length > 0 ? spaceWidth + wordWidth : wordWidth;

    if (current.length > 0 && currentWidth + addedWidth > maxWidth) {
      lines.push(current);
      current = [token];
      currentWidth = wordWidth;
    } else {
      current.push(token);
      currentWidth += addedWidth;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [[]];
}

function drawLine(page: PDFPage, fonts: Fonts, line: LaidOutLine, x: number, y: number, size: number, color: RGB): void {
  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", size);
  let cursor = x;

  for (const token of line) {
    const font = fontFor(fonts, token.bold, token.italic);
    page.drawText(token.text, { x: cursor, y, font, size, color });
    cursor += font.widthOfTextAtSize(token.text, size) + spaceWidth;
  }
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

export type FacilitatorReportBrandingInput = {
  organizationName: string;
  primaryColor: string;
  secondaryColor: string;
  website: string | null;
  contactEmail: string | null;
};

export type FacilitatorReportPdfData = {
  experienceTitle: string;
  clientName: string | null;
  date: string;
  facilitatorName: string;
  /** The approved report's HTML content, from the contentEditable editor. */
  contentHtml: string;
};

function drawCoverPage(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  logoImage: PDFImage | null,
  colors: { primary: RGB; secondary: RGB },
  branding: FacilitatorReportBrandingInput,
  data: FacilitatorReportPdfData
): void {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const BAND_HEIGHT = 160;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: WHITE });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - BAND_HEIGHT, width: PAGE_WIDTH, height: BAND_HEIGHT, color: colors.primary });

  if (logoImage) {
    const maxW = 120;
    const maxH = 55;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height, 1);
    const drawWidth = logoImage.width * scale;
    const drawHeight = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - drawHeight,
      width: drawWidth,
      height: drawHeight,
    });
  }

  page.drawText(branding.organizationName, {
    x: MARGIN,
    y: PAGE_HEIGHT - BAND_HEIGHT + 30,
    font: fonts.bold,
    size: 18,
    color: WHITE,
  });

  let y = PAGE_HEIGHT - BAND_HEIGHT - 50;

  page.drawText("PROGRAM FACILITATOR REPORT", { x: MARGIN, y, font: fonts.bold, size: 11, color: colors.secondary });
  y -= 34;

  page.drawText(data.experienceTitle, { x: MARGIN, y, font: fonts.bold, size: SIZE.coverTitle, color: colors.primary });
  y -= SIZE.coverTitle + 10;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 120, y }, thickness: 1.5, color: colors.secondary });
  y -= 30;

  if (data.clientName) {
    page.drawText(data.clientName, { x: MARGIN, y, font: fonts.regular, size: 13, color: DARK });
    y -= 22;
  }

  page.drawText(formatLongDate(data.date), { x: MARGIN, y, font: fonts.regular, size: SIZE.body, color: MUTED });
  y -= 18;

  page.drawText(`Facilitator: ${data.facilitatorName}`, { x: MARGIN, y, font: fonts.regular, size: SIZE.body, color: MUTED });

  drawWatermark(page, fonts);
}

// ---------------------------------------------------------------------------
// Body pages
// ---------------------------------------------------------------------------

function drawBodyPageHeader(page: PDFPage, fonts: Fonts, colors: { primary: RGB; secondary: RGB }): number {
  let y = PAGE_HEIGHT - MARGIN;
  page.drawText("Program Facilitator Report", {
    x: MARGIN,
    y: y - SIZE.pageHeader,
    font: fonts.bold,
    size: SIZE.pageHeader,
    color: colors.primary,
  });
  y -= SIZE.pageHeader + 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: colors.secondary });
  return y - 26;
}

const FOOTER_RESERVED_HEIGHT = 60;

function drawBodyPages(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  colors: { primary: RGB; secondary: RGB },
  contentHtml: string
): PDFPage[] {
  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = drawBodyPageHeader(page, fonts, colors);

  function ensureRoom(needed: number): void {
    if (y - needed < MARGIN + FOOTER_RESERVED_HEIGHT) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(page);
      y = drawBodyPageHeader(page, fonts, colors);
    }
  }

  const blocks = parseContentBlocks(contentHtml);
  const bodyLineHeight = SIZE.body * LINE_HEIGHT;

  for (const block of blocks) {
    if (block.type === "heading") {
      const lines = layoutTokensIntoLines(block.tokens, fonts, SIZE.heading, CONTENT_WIDTH);
      ensureRoom(lines.length * (SIZE.heading * LINE_HEIGHT) + 10);
      for (const line of lines) {
        y -= SIZE.heading;
        drawLine(page, fonts, line.map((t) => ({ ...t, bold: true })), MARGIN, y, SIZE.heading, colors.primary);
        y -= SIZE.heading * (LINE_HEIGHT - 1);
      }
      y -= 8;
      continue;
    }

    if (block.type === "paragraph") {
      const lines = layoutTokensIntoLines(block.tokens, fonts, SIZE.body, CONTENT_WIDTH);
      for (const line of lines) {
        ensureRoom(bodyLineHeight);
        y -= SIZE.body;
        drawLine(page, fonts, line, MARGIN, y, SIZE.body, DARK);
        y -= SIZE.body * (LINE_HEIGHT - 1);
      }
      y -= 10;
      continue;
    }

    // list
    const bulletIndent = 14;
    for (const item of block.items) {
      const lines = layoutTokensIntoLines(item, fonts, SIZE.body, CONTENT_WIDTH - bulletIndent);
      lines.forEach((line, index) => {
        ensureRoom(bodyLineHeight);
        y -= SIZE.body;
        if (index === 0) {
          page.drawText("•", { x: MARGIN, y, font: fonts.bold, size: SIZE.body, color: DARK });
        }
        drawLine(page, fonts, line, MARGIN + bulletIndent, y, SIZE.body, DARK);
        y -= SIZE.body * (LINE_HEIGHT - 1);
      });
    }
    y -= 8;
  }

  return pages;
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  branding: FacilitatorReportBrandingInput,
  clientName: string | null,
  pageNumber: number,
  totalPages: number
): void {
  const y = MARGIN - 8;
  page.drawLine({ start: { x: MARGIN, y: y + 16 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 16 }, thickness: 0.75, color: MUTED });

  const confidentialText = clientName
    ? `Confidential — prepared for ${clientName}`
    : "Confidential — prepared for client use only";
  page.drawText(`${branding.organizationName} · ${confidentialText}`, {
    x: MARGIN,
    y,
    font: fonts.regular,
    size: SIZE.caption,
    color: MUTED,
  });

  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  const pageLabelWidth = fonts.regular.widthOfTextAtSize(pageLabel, SIZE.caption);
  page.drawText(pageLabel, {
    x: PAGE_WIDTH - MARGIN - pageLabelWidth,
    y,
    font: fonts.regular,
    size: SIZE.caption,
    color: MUTED,
  });
}

export async function generateFacilitatorReportPdf(input: {
  branding: FacilitatorReportBrandingInput;
  logoBytes: Uint8Array | null;
  data: FacilitatorReportPdfData;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const colors = { primary: hexToRgb(input.branding.primaryColor), secondary: hexToRgb(input.branding.secondaryColor) };
  const logoImage = input.logoBytes ? await embedLogo(pdfDoc, input.logoBytes) : null;

  drawCoverPage(pdfDoc, fonts, logoImage, colors, input.branding, input.data);
  const bodyPages = drawBodyPages(pdfDoc, fonts, colors, input.data.contentHtml);

  bodyPages.forEach((page, index) => {
    drawFooter(page, fonts, input.branding, input.data.clientName, index + 1, bodyPages.length);
  });

  return pdfDoc.save();
}
