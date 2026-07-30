import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

import type { SatisfactionReportData } from "./data";

// ---------------------------------------------------------------------------
// Layout constants — A4 portrait. Typography and margins per the Sprint 29
// brief: Helvetica/Helvetica-Bold only, 1.4x line height for body text,
// 50pt margins on every page.
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 1.4;

const SIZE = {
  coverTitle: 28,
  pageHeader: 18,
  sectionHeader: 14,
  body: 10,
  caption: 8,
};

const WHITE = rgb(1, 1, 1);
const DARK = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.45, 0.45, 0.45);
const LIGHT_TRACK = rgb(0.9, 0.9, 0.9);

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);

  if (Number.isNaN(bigint)) {
    return rgb(0, 0, 0);
  }

  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

function scoreColor(score: number): RGB {
  if (score >= 4.0) return rgb(0.09, 0.55, 0.35);
  if (score >= 3.0) return rgb(0.82, 0.58, 0.13);
  return rgb(0.78, 0.2, 0.2);
}

function formatLongDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type Fonts = { regular: PDFFont; bold: PDFFont };

async function loadFonts(pdfDoc: PDFDocument): Promise<Fonts> {
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function isPng(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

async function embedLogo(pdfDoc: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  return isPng(bytes) ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

/** Draws a wrapped body paragraph and returns the y cursor after it. */
function drawParagraph(
  page: PDFPage,
  text: string,
  x: number,
  yTop: number,
  font: PDFFont,
  size: number,
  color: RGB,
  maxWidth: number
): number {
  const lineHeight = size * LINE_HEIGHT;
  let y = yTop;

  for (const line of wrapText(text, font, size, maxWidth)) {
    page.drawText(line, { x, y: y - size, font, size, color });
    y -= lineHeight;
  }

  return y;
}

/** Page header + secondary-color rule shared by pages 2-4. Returns the y cursor below it. */
function drawPageHeader(page: PDFPage, fonts: Fonts, title: string, primary: RGB, secondary: RGB): number {
  let y = PAGE_HEIGHT - MARGIN;
  page.drawText(title, { x: MARGIN, y: y - SIZE.pageHeader, font: fonts.bold, size: SIZE.pageHeader, color: primary });
  y -= SIZE.pageHeader + 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: secondary });
  return y - 24;
}

// ---------------------------------------------------------------------------
// Branding input — the subset of report_branding a page-drawing function
// needs. Kept separate from features/reports/data.ts's ReportBranding so
// this module never depends on a DB row shape, only plain values.
// ---------------------------------------------------------------------------

export type ReportBrandingInput = {
  organizationName: string;
  organizationTagline: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string | null;
  website: string | null;
  contactEmail: string | null;
};

type CoverPageData = {
  experienceTitle: string;
  clientName: string | null;
  venue: string | null;
  startDate: string;
  endDate: string;
};

// ---------------------------------------------------------------------------
// Page 1 — Cover
// ---------------------------------------------------------------------------

function drawCoverPage(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  logoImage: PDFImage | null,
  colors: { primary: RGB; secondary: RGB },
  branding: ReportBrandingInput,
  data: CoverPageData
): void {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const BAND_HEIGHT = 180;
  const FOOTER_HEIGHT = 40;

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: WHITE });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - BAND_HEIGHT, width: PAGE_WIDTH, height: BAND_HEIGHT, color: colors.primary });
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: FOOTER_HEIGHT, color: colors.primary });

  if (logoImage) {
    const maxW = 120;
    const maxH = 60;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
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
    y: PAGE_HEIGHT - BAND_HEIGHT + 34,
    font: fonts.bold,
    size: 22,
    color: WHITE,
  });

  let y = PAGE_HEIGHT - BAND_HEIGHT - 40;

  page.drawText("TRAINING EVALUATION REPORT", {
    x: MARGIN,
    y,
    font: fonts.bold,
    size: 11,
    color: colors.secondary,
  });
  y -= 32;

  for (const line of wrapText(data.experienceTitle, fonts.bold, SIZE.coverTitle, CONTENT_WIDTH)) {
    page.drawText(line, { x: MARGIN, y, font: fonts.bold, size: SIZE.coverTitle, color: colors.primary });
    y -= SIZE.coverTitle * LINE_HEIGHT;
  }
  y -= 6;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 120, y }, thickness: 1.5, color: colors.secondary });
  y -= 28;

  if (data.clientName) {
    page.drawText(data.clientName, { x: MARGIN, y, font: fonts.regular, size: 13, color: DARK });
    y -= 22;
  }

  page.drawText(`${formatLongDate(data.startDate)} – ${formatLongDate(data.endDate)}`, {
    x: MARGIN,
    y,
    font: fonts.regular,
    size: SIZE.body,
    color: MUTED,
  });
  y -= 16;

  if (data.venue) {
    page.drawText(data.venue, { x: MARGIN, y, font: fonts.regular, size: SIZE.body, color: MUTED });
    y -= 16;
  }

  page.drawText(`Prepared by: ${branding.organizationName}`, {
    x: MARGIN,
    y,
    font: fonts.regular,
    size: SIZE.body,
    color: MUTED,
  });
  y -= 16;

  page.drawText(`Report date: ${formatLongDate(new Date().toISOString())}`, {
    x: MARGIN,
    y,
    font: fonts.regular,
    size: SIZE.body,
    color: MUTED,
  });

  const footerParts = [branding.website, branding.contactEmail].filter((part): part is string => Boolean(part));
  if (footerParts.length > 0) {
    page.drawText(footerParts.join("   ·   "), {
      x: MARGIN,
      y: 15,
      font: fonts.regular,
      size: SIZE.caption,
      color: WHITE,
    });
  }
}

// ---------------------------------------------------------------------------
// Page 2 — Executive Summary
// ---------------------------------------------------------------------------

function drawMetricBox(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  boxTop: number,
  width: number,
  height: number,
  value: number | null,
  label: string,
  primary: RGB,
  accentBg: RGB
): void {
  page.drawRectangle({ x, y: boxTop - height, width, height, color: accentBg });

  const valueText = value !== null ? value.toFixed(1) : "—";
  const valueSize = 26;
  const valueWidth = fonts.bold.widthOfTextAtSize(valueText, valueSize);
  page.drawText(valueText, {
    x: x + (width - valueWidth) / 2,
    y: boxTop - height / 2 - 2,
    font: fonts.bold,
    size: valueSize,
    color: primary,
  });

  const labelWidth = fonts.regular.widthOfTextAtSize(label, SIZE.caption);
  page.drawText(label, {
    x: x + (width - labelWidth) / 2,
    y: boxTop - height + 14,
    font: fonts.regular,
    size: SIZE.caption,
    color: MUTED,
  });
}

function drawExecutiveSummaryPage(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  colors: { primary: RGB; secondary: RGB },
  accent: RGB,
  data: SatisfactionReportData
): void {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawPageHeader(page, fonts, "Executive Summary", colors.primary, colors.secondary);

  const gap = 16;
  const boxWidth = (CONTENT_WIDTH - gap) / 2;
  const boxHeight = 76;
  const gridTop = y;

  data.dimensions.forEach((dimension, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (boxWidth + gap);
    const boxTop = gridTop - row * (boxHeight + gap);
    drawMetricBox(page, fonts, x, boxTop, boxWidth, boxHeight, dimension.average, dimension.label, colors.primary, accent);
  });

  y = gridTop - 2 * boxHeight - gap - 34;

  const overall = data.dimensions.find((d) => d.key === "overall")?.average ?? null;
  const tierColor = overall === null ? rgb(0.55, 0.55, 0.55) : scoreColor(overall);
  const circleRadius = 42;
  const circleX = PAGE_WIDTH / 2;
  const circleY = y - circleRadius;

  page.drawEllipse({ x: circleX, y: circleY, xScale: circleRadius, yScale: circleRadius, color: tierColor });

  const overallText = overall !== null ? overall.toFixed(1) : "—";
  const overallSize = 30;
  const overallWidth = fonts.bold.widthOfTextAtSize(overallText, overallSize);
  page.drawText(overallText, {
    x: circleX - overallWidth / 2,
    y: circleY - overallSize / 2 + 8,
    font: fonts.bold,
    size: overallSize,
    color: WHITE,
  });

  y = circleY - circleRadius - 18;
  const capLabel = "OVERALL SATISFACTION";
  const capWidth = fonts.regular.widthOfTextAtSize(capLabel, SIZE.caption);
  page.drawText(capLabel, { x: circleX - capWidth / 2, y, font: fonts.regular, size: SIZE.caption, color: MUTED });
  y -= 30;

  const statsLine = `Total participants: ${data.totalParticipants}     Surveys sent: ${data.surveysSent}     Responses received: ${data.surveysCompleted}     Response rate: ${data.responseRate}%`;
  y = drawParagraph(page, statsLine, MARGIN, y, fonts.regular, SIZE.body, DARK, CONTENT_WIDTH);
  y -= 16;

  drawParagraph(page, data.narrative, MARGIN, y, fonts.regular, SIZE.body, DARK, CONTENT_WIDTH);
}

// ---------------------------------------------------------------------------
// Page 3 — Dimension Analysis
// ---------------------------------------------------------------------------

const DIMENSION_SECTION_HEIGHT = 150;

function drawDimensionSection(
  page: PDFPage,
  fonts: Fonts,
  colors: { primary: RGB; secondary: RGB },
  top: number,
  dimension: SatisfactionReportData["dimensions"][number]
): void {
  page.drawText(dimension.label, {
    x: MARGIN,
    y: top - SIZE.sectionHeader,
    font: fonts.bold,
    size: SIZE.sectionHeader,
    color: colors.primary,
  });

  const avgText = dimension.average !== null ? `${dimension.average.toFixed(1)} / 5` : "— / 5";
  const avgSize = 20;
  const avgWidth = fonts.bold.widthOfTextAtSize(avgText, avgSize);
  page.drawText(avgText, {
    x: PAGE_WIDTH - MARGIN - avgWidth,
    y: top - avgSize + 3,
    font: fonts.bold,
    size: avgSize,
    color: colors.primary,
  });

  let y = top - SIZE.sectionHeader - 20;

  const barHeight = 10;
  page.drawRectangle({ x: MARGIN, y: y - barHeight, width: CONTENT_WIDTH, height: barHeight, color: LIGHT_TRACK });
  const pct = dimension.average !== null ? Math.max(0, Math.min(1, dimension.average / 5)) : 0;
  if (pct > 0) {
    page.drawRectangle({ x: MARGIN, y: y - barHeight, width: CONTENT_WIDTH * pct, height: barHeight, color: colors.secondary });
  }
  y -= barHeight + 18;

  const distMax = Math.max(...dimension.distribution, 1);
  const barGap = 10;
  const barWidth = (CONTENT_WIDTH - barGap * 4) / 5;
  const maxBarHeight = 40;
  const baseline = y - maxBarHeight;

  for (let star = 1; star <= 5; star++) {
    const count = dimension.distribution[star - 1];
    const barPixelHeight = count > 0 ? Math.max((count / distMax) * maxBarHeight, 2) : 0;
    const x = MARGIN + (star - 1) * (barWidth + barGap);

    if (barPixelHeight > 0) {
      page.drawRectangle({ x, y: baseline, width: barWidth, height: barPixelHeight, color: colors.secondary });
    }

    const label = `${star} star (${count})`;
    const labelWidth = fonts.regular.widthOfTextAtSize(label, SIZE.caption);
    page.drawText(label, {
      x: x + (barWidth - labelWidth) / 2,
      y: baseline - 12,
      font: fonts.regular,
      size: SIZE.caption,
      color: MUTED,
    });
  }
}

function drawDimensionAnalysisPage(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  colors: { primary: RGB; secondary: RGB },
  data: SatisfactionReportData
): void {
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawPageHeader(page, fonts, "Dimension Analysis", colors.primary, colors.secondary);

  for (const dimension of data.dimensions) {
    if (y - DIMENSION_SECTION_HEIGHT < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawPageHeader(page, fonts, "Dimension Analysis (continued)", colors.primary, colors.secondary);
    }

    drawDimensionSection(page, fonts, colors, y, dimension);
    y -= DIMENSION_SECTION_HEIGHT;
  }
}

// ---------------------------------------------------------------------------
// Page 4 — Participant Feedback (anonymized open text)
// ---------------------------------------------------------------------------

function drawFeedbackPages(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  colors: { primary: RGB; secondary: RGB },
  data: SatisfactionReportData
): void {
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawPageHeader(page, fonts, "Participant Feedback", colors.primary, colors.secondary);

  y = drawParagraph(
    page,
    "Responses are presented anonymously to protect participant confidentiality.",
    MARGIN,
    y,
    fonts.regular,
    SIZE.body,
    MUTED,
    CONTENT_WIDTH
  );
  y -= 14;

  function ensureRoom(needed: number): void {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawPageHeader(page, fonts, "Participant Feedback (continued)", colors.primary, colors.secondary);
    }
  }

  const sections: { heading: string; items: string[] }[] = [
    { heading: "What participants found most valuable", items: data.feedback.valuable },
    { heading: "Areas for improvement", items: data.feedback.improvements },
    { heading: "Additional comments", items: data.feedback.additionalComments },
  ];

  const bulletIndent = 14;
  const maxWidth = CONTENT_WIDTH - bulletIndent;
  const lineHeight = SIZE.body * LINE_HEIGHT * 1.15;

  for (const section of sections) {
    ensureRoom(SIZE.sectionHeader + 14);
    page.drawText(section.heading, {
      x: MARGIN,
      y: y - SIZE.sectionHeader,
      font: fonts.bold,
      size: SIZE.sectionHeader,
      color: colors.secondary,
    });
    y -= SIZE.sectionHeader + 16;

    if (section.items.length === 0) {
      ensureRoom(lineHeight);
      page.drawText("No responses provided for this section.", {
        x: MARGIN,
        y: y - SIZE.body,
        font: fonts.regular,
        size: SIZE.body,
        color: MUTED,
      });
      y -= lineHeight + 20;
      continue;
    }

    for (const item of section.items) {
      const lines = wrapText(item, fonts.regular, SIZE.body, maxWidth);
      const blockHeight = lines.length * lineHeight;
      ensureRoom(blockHeight);

      page.drawText("•", { x: MARGIN, y: y - SIZE.body, font: fonts.bold, size: SIZE.body, color: DARK });

      let lineY = y;
      for (const line of lines) {
        page.drawText(line, { x: MARGIN + bulletIndent, y: lineY - SIZE.body, font: fonts.regular, size: SIZE.body, color: DARK });
        lineY -= lineHeight;
      }
      y = lineY - 6;
    }

    y -= 16;
  }
}

// ---------------------------------------------------------------------------
// Page 5 — Closing
// ---------------------------------------------------------------------------

function drawClosingPage(
  pdfDoc: PDFDocument,
  fonts: Fonts,
  colors: { primary: RGB; secondary: RGB },
  branding: ReportBrandingInput
): void {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const centerX = PAGE_WIDTH / 2;

  let y = PAGE_HEIGHT / 2 + 60;

  page.drawLine({ start: { x: centerX - 40, y }, end: { x: centerX + 40, y }, thickness: 2, color: colors.secondary });
  y -= 40;

  const orgWidth = fonts.bold.widthOfTextAtSize(branding.organizationName, 16);
  page.drawText(branding.organizationName, { x: centerX - orgWidth / 2, y, font: fonts.bold, size: 16, color: colors.primary });
  y -= 22;

  if (branding.organizationTagline) {
    const tagWidth = fonts.regular.widthOfTextAtSize(branding.organizationTagline, SIZE.body);
    page.drawText(branding.organizationTagline, { x: centerX - tagWidth / 2, y, font: fonts.regular, size: SIZE.body, color: MUTED });
    y -= 24;
  }

  if (branding.footerText) {
    for (const line of wrapText(branding.footerText, fonts.regular, SIZE.caption, 380)) {
      const width = fonts.regular.widthOfTextAtSize(line, SIZE.caption);
      page.drawText(line, { x: centerX - width / 2, y, font: fonts.regular, size: SIZE.caption, color: MUTED });
      y -= SIZE.caption * LINE_HEIGHT;
    }
    y -= 10;
  }

  y -= 10;
  page.drawLine({ start: { x: centerX - 30, y }, end: { x: centerX + 30, y }, thickness: 1, color: colors.secondary });

  const footerParts = [branding.website, branding.contactEmail].filter((part): part is string => Boolean(part));
  if (footerParts.length > 0) {
    const footerText = footerParts.join("   ·   ");
    const width = fonts.regular.widthOfTextAtSize(footerText, SIZE.caption);
    page.drawText(footerText, { x: centerX - width / 2, y: MARGIN, font: fonts.regular, size: SIZE.caption, color: MUTED });
  }
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Full five-page client-facing report. Runs server-side only — never import
 * this from a Client Component. Takes plain input (branding + pre-aggregated
 * report data), matching features/certificates/pdf.ts's pattern of keeping
 * the PDF generator itself free of any database access.
 */
export async function generateSatisfactionReportPdf(input: {
  branding: ReportBrandingInput;
  logoBytes: Uint8Array | null;
  data: SatisfactionReportData;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const colors = { primary: hexToRgb(input.branding.primaryColor), secondary: hexToRgb(input.branding.secondaryColor) };
  const accent = hexToRgb(input.branding.accentColor);
  const logoImage = input.logoBytes ? await embedLogo(pdfDoc, input.logoBytes) : null;

  drawCoverPage(pdfDoc, fonts, logoImage, colors, input.branding, input.data);
  drawExecutiveSummaryPage(pdfDoc, fonts, colors, accent, input.data);
  drawDimensionAnalysisPage(pdfDoc, fonts, colors, input.data);
  drawFeedbackPages(pdfDoc, fonts, colors, input.data);
  drawClosingPage(pdfDoc, fonts, colors, input.branding);

  return pdfDoc.save();
}

/**
 * Single-page cover preview for the branding settings form — lets an
 * operator see how their colors/logo/copy will render without generating a
 * full report against real survey data.
 */
export async function generateReportPreviewPdf(
  branding: ReportBrandingInput,
  logoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const colors = { primary: hexToRgb(branding.primaryColor), secondary: hexToRgb(branding.secondaryColor) };
  const logoImage = logoBytes ? await embedLogo(pdfDoc, logoBytes) : null;

  const now = new Date().toISOString();
  drawCoverPage(pdfDoc, fonts, logoImage, colors, branding, {
    experienceTitle: "Sample Experience: Leading Through Change",
    clientName: "Sample Client Organization",
    venue: "Riyadh, Saudi Arabia",
    startDate: now,
    endDate: now,
  });

  return pdfDoc.save();
}
