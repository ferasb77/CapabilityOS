import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

import type { AttendanceSheetData } from "./data";

// ---------------------------------------------------------------------------
// Layout constants — A4 portrait, same page geometry as
// features/reports/report.ts (Sprint 29). Helpers below are intentionally
// duplicated rather than shared with that module, matching how
// features/certificates/pdf.ts already keeps its own copy of the same kind
// of small pdf-lib utilities — each PDF generator in this codebase stays
// self-contained.
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const SIZE = {
  pageTitle: 20,
  sectionHeader: 12,
  body: 10,
  caption: 8,
};

const WHITE = rgb(1, 1, 1);
const DARK = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.45, 0.45, 0.45);
const BORDER = rgb(0.75, 0.75, 0.75);
const ROW_SHADE = rgb(0.96, 0.96, 0.96);

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);

  if (Number.isNaN(bigint)) {
    return rgb(0, 0, 0);
  }

  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
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

/** "Monday, 21 July 2026" — matches the Attendance tab's date formatting. */
function formatLongDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCheckInTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}…`;
}

export type AttendanceReportBrandingInput = {
  organizationName: string;
  primaryColor: string;
  secondaryColor: string;
  website: string | null;
  contactEmail: string | null;
};

// ---------------------------------------------------------------------------
// Table geometry
// ---------------------------------------------------------------------------

const COLUMNS = [
  { key: "index", label: "#", width: 25 },
  { key: "name", label: "Participant Name", width: 130 },
  { key: "company", label: "Company", width: 110 },
  { key: "jobTitle", label: "Job Title", width: 100 },
  { key: "checkInTime", label: "Check-In Time", width: 70 },
  { key: "signature", label: "Signature", width: 60 },
] as const;

const ROW_HEIGHT = 24;
const HEADER_ROW_HEIGHT = 22;
const FOOTER_RESERVED_HEIGHT = 70;

function columnX(index: number): number {
  let x = MARGIN;
  for (let i = 0; i < index; i++) {
    x += COLUMNS[i].width;
  }
  return x;
}

function drawTableHeaderRow(page: PDFPage, fonts: Fonts, colors: { primary: RGB }, top: number): number {
  page.drawRectangle({ x: MARGIN, y: top - HEADER_ROW_HEIGHT, width: CONTENT_WIDTH, height: HEADER_ROW_HEIGHT, color: colors.primary });

  COLUMNS.forEach((column, index) => {
    page.drawText(column.label, {
      x: columnX(index) + 6,
      y: top - HEADER_ROW_HEIGHT + 7,
      font: fonts.bold,
      size: SIZE.caption,
      color: WHITE,
    });
  });

  return top - HEADER_ROW_HEIGHT;
}

function drawTableRow(
  page: PDFPage,
  fonts: Fonts,
  top: number,
  rowIndex: number,
  values: { index: string; name: string; company: string; jobTitle: string; checkInTime: string }
): number {
  const rowBottom = top - ROW_HEIGHT;

  if (rowIndex % 2 === 1) {
    page.drawRectangle({ x: MARGIN, y: rowBottom, width: CONTENT_WIDTH, height: ROW_HEIGHT, color: ROW_SHADE });
  }

  const cells: { key: (typeof COLUMNS)[number]["key"]; text: string }[] = [
    { key: "index", text: values.index },
    { key: "name", text: values.name },
    { key: "company", text: values.company },
    { key: "jobTitle", text: values.jobTitle },
    { key: "checkInTime", text: values.checkInTime },
  ];

  cells.forEach((cell) => {
    const columnIndex = COLUMNS.findIndex((column) => column.key === cell.key);
    const column = COLUMNS[columnIndex];
    const maxWidth = column.width - 10;
    const text = truncateToWidth(cell.text, fonts.regular, SIZE.body, maxWidth);

    page.drawText(text, {
      x: columnX(columnIndex) + 5,
      y: rowBottom + 8,
      font: fonts.regular,
      size: SIZE.body,
      color: DARK,
    });
  });

  // Signature line — blank; present so a printed copy can be physically signed.
  const signatureIndex = COLUMNS.findIndex((column) => column.key === "signature");
  const signatureX = columnX(signatureIndex);
  page.drawLine({
    start: { x: signatureX + 6, y: rowBottom + 5 },
    end: { x: signatureX + COLUMNS[signatureIndex].width - 6, y: rowBottom + 5 },
    thickness: 0.5,
    color: BORDER,
  });

  page.drawLine({ start: { x: MARGIN, y: rowBottom }, end: { x: MARGIN + CONTENT_WIDTH, y: rowBottom }, thickness: 0.5, color: BORDER });

  return rowBottom;
}

function drawTableBorders(page: PDFPage, top: number, bottom: number): void {
  page.drawRectangle({
    x: MARGIN,
    y: bottom,
    width: CONTENT_WIDTH,
    height: top - bottom,
    borderColor: BORDER,
    borderWidth: 0.75,
  });

  let x = MARGIN;
  for (let i = 0; i < COLUMNS.length - 1; i++) {
    x += COLUMNS[i].width;
    page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.5, color: BORDER });
  }
}

function drawSheetHeader(
  page: PDFPage,
  fonts: Fonts,
  colors: { primary: RGB; secondary: RGB },
  logoImage: PDFImage | null,
  branding: AttendanceReportBrandingInput,
  continued: boolean
): number {
  let y = PAGE_HEIGHT - MARGIN;

  if (logoImage) {
    const maxW = 90;
    const maxH = 40;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height, 1);
    const drawWidth = logoImage.width * scale;
    const drawHeight = logoImage.height * scale;
    page.drawImage(logoImage, { x: MARGIN, y: y - drawHeight, width: drawWidth, height: drawHeight });
    page.drawText(branding.organizationName, {
      x: MARGIN + drawWidth + 12,
      y: y - drawHeight / 2 - 5,
      font: fonts.bold,
      size: SIZE.sectionHeader,
      color: DARK,
    });
    y -= Math.max(drawHeight, 30) + 14;
  } else {
    page.drawText(branding.organizationName, { x: MARGIN, y: y - SIZE.sectionHeader, font: fonts.bold, size: SIZE.sectionHeader, color: DARK });
    y -= SIZE.sectionHeader + 14;
  }

  const title = continued ? "Attendance Record (continued)" : "Attendance Record";
  page.drawText(title, { x: MARGIN, y: y - SIZE.pageTitle, font: fonts.bold, size: SIZE.pageTitle, color: colors.primary });
  y -= SIZE.pageTitle + 10;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.5, color: colors.secondary });

  return y - 20;
}

function drawProgramDetailsBox(
  page: PDFPage,
  fonts: Fonts,
  top: number,
  data: AttendanceSheetData
): number {
  const lines: string[] = [
    data.experienceTitle,
    ...(data.clientName ? [`Client: ${data.clientName}`] : []),
    `Date: ${formatLongDate(data.date)}`,
    `Day ${data.dayNumber} of ${data.totalDays}`,
    ...(data.venue ? [`Venue: ${data.venue}`] : []),
    ...(data.facilitatorName ? [`Facilitator: ${data.facilitatorName}`] : []),
  ];

  const boxHeight = 16 + lines.length * 15;
  page.drawRectangle({
    x: MARGIN,
    y: top - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: BORDER,
    borderWidth: 0.75,
  });

  let y = top - 16;
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: MARGIN + 12,
      y: y - 10,
      font: index === 0 ? fonts.bold : fonts.regular,
      size: index === 0 ? SIZE.sectionHeader : SIZE.body,
      color: index === 0 ? DARK : MUTED,
    });
    y -= 15;
  });

  return top - boxHeight - 20;
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  branding: AttendanceReportBrandingInput,
  summary: { present: number; total: number },
  pageNumber: number,
  totalPages: number
): void {
  const rate = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;
  let y = MARGIN;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: BORDER });
  y -= 16;

  page.drawText(`Total present: ${summary.present} of ${summary.total} participants (${rate}%)`, {
    x: MARGIN,
    y,
    font: fonts.bold,
    size: SIZE.caption,
    color: DARK,
  });

  const generatedText = `Generated by CapabilityOS on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  const generatedWidth = fonts.regular.widthOfTextAtSize(generatedText, SIZE.caption);
  page.drawText(generatedText, {
    x: PAGE_WIDTH - MARGIN - generatedWidth,
    y,
    font: fonts.regular,
    size: SIZE.caption,
    color: MUTED,
  });
  y -= 14;

  const contactParts = [branding.website, branding.contactEmail].filter((part): part is string => Boolean(part));
  if (contactParts.length > 0) {
    page.drawText(contactParts.join("   ·   "), { x: MARGIN, y, font: fonts.regular, size: SIZE.caption, color: MUTED });
  }

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

/**
 * One row per registered participant (not just those who checked in) — a
 * printable attendance sheet is also how an operator captures a physical
 * signature from anyone who didn't scan the QR code that day.
 */
export async function generateAttendanceSheetPdf(input: {
  branding: AttendanceReportBrandingInput;
  logoBytes: Uint8Array | null;
  data: AttendanceSheetData;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const colors = { primary: hexToRgb(input.branding.primaryColor), secondary: hexToRgb(input.branding.secondaryColor) };
  const logoImage = input.logoBytes ? await embedLogo(pdfDoc, input.logoBytes) : null;

  type PageEntry = { page: PDFPage; tableTop: number; tableBottom: number };
  const pages: PageEntry[] = [];

  function startPage(continued: boolean): PageEntry {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = drawSheetHeader(page, fonts, colors, logoImage, input.branding, continued);

    if (!continued) {
      y = drawProgramDetailsBox(page, fonts, y, input.data);
    }

    const tableTop = drawTableHeaderRow(page, fonts, colors, y);
    const entry = { page, tableTop, tableBottom: tableTop };
    pages.push(entry);
    return entry;
  }

  let current = startPage(false);
  let present = 0;

  input.data.participants.forEach((participant, index) => {
    if (current.tableBottom - ROW_HEIGHT < MARGIN + FOOTER_RESERVED_HEIGHT) {
      drawTableBorders(current.page, current.tableTop, current.tableBottom);
      current = startPage(true);
    }

    if (participant.checkedInAt) {
      present += 1;
    }

    current.tableBottom = drawTableRow(current.page, fonts, current.tableBottom, index, {
      index: String(index + 1),
      name: `${participant.firstName} ${participant.lastName}`.trim(),
      company: participant.company ?? "",
      jobTitle: participant.jobTitle ?? "",
      checkInTime: participant.checkedInAt ? formatCheckInTime(participant.checkedInAt) : "",
    });
  });

  drawTableBorders(current.page, current.tableTop, current.tableBottom);

  const summary = { present, total: input.data.participants.length };
  pages.forEach((entry, index) => {
    drawFooter(entry.page, fonts, input.branding, summary, index + 1, pages.length);
  });

  return pdfDoc.save();
}
