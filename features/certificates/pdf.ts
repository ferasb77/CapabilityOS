import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";

import type { FieldPlacements } from "./schema";
import { getCairoFontBytes } from "./lib/cairo-font";
import { downloadTemplatePdf } from "./storage";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const BORDER_INSET = 20;
const BORDER_WIDTH = 2;
const CORNER_SIZE = 8;

export type CertificatePdfInput = {
  organizationName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  titleText: string;
  bodyText: string;
  footerText: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  participantName: string;
  /** True when participantName is the participant's Arabic name (both
   * first_name_ar and last_name_ar were set) rather than their English one. */
  participantNameIsArabic: boolean;
  experienceTitle: string;
  /** True when experienceTitle is experiences.title_ar rather than title. */
  experienceTitleIsArabic: boolean;
  completionDate: string;
  verificationUrl: string;
};

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);

  if (Number.isNaN(bigint)) {
    return rgb(0, 0, 0);
  }

  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

function formatCompletionDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type FontSet = { regular: PDFFont; bold: PDFFont };

async function loadStandardFonts(pdfDoc: PDFDocument, fontFamily: string): Promise<FontSet> {
  const isSans = fontFamily.toLowerCase().includes("sans");

  return {
    regular: await pdfDoc.embedFont(isSans ? StandardFonts.Helvetica : StandardFonts.TimesRoman),
    bold: await pdfDoc.embedFont(isSans ? StandardFonts.HelveticaBold : StandardFonts.TimesRomanBold),
  };
}

/**
 * Loads Cairo (Regular + Bold) as a custom embedded font, only when a
 * certificate actually needs Arabic text — the fetch has real latency, so
 * an all-English certificate never pays for it. Returns `null` (never
 * throws) if the CDN fetch fails, so callers can fall back to a standard
 * font rather than fail certificate generation.
 */
async function loadCairoFonts(pdfDoc: PDFDocument): Promise<FontSet | null> {
  const bytes = await getCairoFontBytes();
  if (!bytes) {
    return null;
  }

  pdfDoc.registerFontkit(fontkit);

  const [regular, bold] = await Promise.all([pdfDoc.embedFont(bytes.regular), pdfDoc.embedFont(bytes.bold)]);

  return { regular, bold };
}

/**
 * pdf-lib/fontkit parses font files but does not run a text-shaping engine
 * (no bidi reordering, no Arabic contextual glyph joining) — drawText would
 * otherwise lay Arabic characters out left-to-right and in their isolated
 * presentation form. Reversing the codepoint order at least gets the
 * overall reading direction right; full cursive joining would need a
 * HarfBuzz-class shaping engine, out of scope here.
 */
function toVisualOrder(text: string): string {
  return Array.from(text).reverse().join("");
}

function drawCentered(
  page: import("pdf-lib").PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, font, size, color });
}

const MAX_TEXT_WIDTH = PAGE_WIDTH - 160;

/**
 * Participant names and experience titles are unbounded user data — shrink
 * the font (down to a floor) rather than let a long one overrun the card's
 * border, since there's no line-wrapping in this single-line layout.
 */
function fittedSize(text: string, font: PDFFont, size: number): number {
  let fitted = size;
  while (fitted > 10 && font.widthOfTextAtSize(text, fitted) > MAX_TEXT_WIDTH) {
    fitted -= 1;
  }
  return fitted;
}

/**
 * Geometric shapes and standard PDF fonts for everything except the
 * participant name / experience title fields, which switch to an embedded
 * Cairo font when their Arabic form is in use (Sprint 27) — no embedded
 * logo images otherwise, per the Sprint 16 brief. Runs server-side only;
 * never import this from a Client Component.
 */
export async function generateCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const primary = hexToRgb(input.primaryColor);
  const secondary = hexToRgb(input.secondaryColor);
  const background = hexToRgb(input.backgroundColor);
  const muted = rgb(0.45, 0.45, 0.45);
  const ink = rgb(0.12, 0.12, 0.12);

  const { regular, bold } = await loadStandardFonts(pdfDoc, input.fontFamily);

  const needsCairo = input.participantNameIsArabic || input.experienceTitleIsArabic;
  const cairo = needsCairo ? await loadCairoFonts(pdfDoc) : null;

  const participantFont = input.participantNameIsArabic && cairo ? cairo.bold : bold;
  const participantText = input.participantNameIsArabic ? toVisualOrder(input.participantName) : input.participantName;

  const experienceFont = input.experienceTitleIsArabic && cairo ? cairo.bold : bold;
  const experienceText = input.experienceTitleIsArabic ? toVisualOrder(input.experienceTitle) : input.experienceTitle;

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: background });

  page.drawRectangle({
    x: BORDER_INSET,
    y: BORDER_INSET,
    width: PAGE_WIDTH - BORDER_INSET * 2,
    height: PAGE_HEIGHT - BORDER_INSET * 2,
    borderColor: primary,
    borderWidth: BORDER_WIDTH,
  });

  const cornerInset = BORDER_INSET + 6;
  for (const x of [cornerInset, PAGE_WIDTH - cornerInset - CORNER_SIZE]) {
    for (const y of [cornerInset, PAGE_HEIGHT - cornerInset - CORNER_SIZE]) {
      page.drawRectangle({ x, y, width: CORNER_SIZE, height: CORNER_SIZE, color: primary });
    }
  }

  drawCentered(page, input.organizationName.toUpperCase(), 500, bold, 16, ink);

  page.drawLine({
    start: { x: PAGE_WIDTH / 2 - 60, y: 486 },
    end: { x: PAGE_WIDTH / 2 + 60, y: 486 },
    thickness: 1,
    color: primary,
  });

  drawCentered(page, input.titleText, 432, bold, 34, secondary);

  drawCentered(page, input.bodyText, 384, regular, 14, muted);
  drawCentered(page, participantText, 348, participantFont, fittedSize(participantText, participantFont, 28), ink);

  drawCentered(page, "for successfully completing", 310, regular, 13, muted);
  drawCentered(page, experienceText, 276, experienceFont, fittedSize(experienceText, experienceFont, 20), primary);

  drawCentered(page, `Completed on ${formatCompletionDate(input.completionDate)}`, 240, regular, 11, muted);

  const signatoryX = 70;
  if (input.signatoryName) {
    page.drawLine({
      start: { x: signatoryX, y: 108 },
      end: { x: signatoryX + 160, y: 108 },
      thickness: 1,
      color: muted,
    });
    page.drawText(input.signatoryName, { x: signatoryX, y: 90, font: bold, size: 12, color: ink });
    if (input.signatoryTitle) {
      page.drawText(input.signatoryTitle, { x: signatoryX, y: 74, font: regular, size: 10, color: muted });
    }
  }

  const verifyText = `Verify at: ${input.verificationUrl}`;
  const verifyWidth = regular.widthOfTextAtSize(verifyText, 9);
  page.drawText(verifyText, {
    x: PAGE_WIDTH - BORDER_INSET - 24 - verifyWidth,
    y: 74,
    font: regular,
    size: 9,
    color: muted,
  });

  if (input.footerText) {
    drawCentered(page, input.footerText, 48, regular, 9, muted);
  }

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Uploaded template — draws the same five dynamic fields onto an
// operator-supplied background PDF instead of a pdf-lib-drawn layout.
// ---------------------------------------------------------------------------

export type UploadedCertificateInput = {
  uploadedPdfPath: string;
  fieldPlacements: FieldPlacements;
  participantName: string;
  participantNameIsArabic: boolean;
  experienceTitle: string;
  experienceTitleIsArabic: boolean;
  organizationName: string;
  completionDate: string;
  verificationCode: string;
};

const FIELD_VALUE_MAP: Record<
  keyof FieldPlacements,
  (input: UploadedCertificateInput) => string
> = {
  participant_name: (input) => input.participantName,
  experience_title: (input) => input.experienceTitle,
  completion_date: (input) => formatCompletionDate(input.completionDate),
  organization_name: (input) => input.organizationName,
  verification_code: (input) => input.verificationCode,
};

/** Only these two fields can ever be Arabic (see UploadedCertificateInput) —
 * organization name, completion date, and verification code stay Latin
 * script per the Sprint 27 brief. */
const ARABIC_ELIGIBLE_FIELDS: Partial<Record<keyof FieldPlacements, (input: UploadedCertificateInput) => boolean>> = {
  participant_name: (input) => input.participantNameIsArabic,
  experience_title: (input) => input.experienceTitleIsArabic,
};

/**
 * Loads the operator's uploaded PDF as-is (no border/corners/background
 * drawn — that's the whole point of "uploaded", the design IS the PDF) and
 * overlays the five dynamic fields at their configured positions. Alignment
 * is resolved here, not stored: `field_placements.x` is always the anchor
 * point pdf-lib's drawText would use for left alignment, so center/right
 * shift the actual draw origin left by the measured text width (half of it
 * for center) — the same technique drawCentered above uses, generalized to
 * three alignments and driven by data instead of being hardcoded per field.
 */
export async function generateCertificateFromUpload(input: UploadedCertificateInput): Promise<Uint8Array> {
  const templateBytes = await downloadTemplatePdf(input.uploadedPdfPath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];

  if (!page) {
    throw new Error("The uploaded template PDF has no pages.");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const needsCairo = input.participantNameIsArabic || input.experienceTitleIsArabic;
  // Loaded lazily on first Arabic field, not unconditionally — matches
  // generateCertificatePdf's reasoning for why an all-English certificate
  // shouldn't pay for the CDN fetch.
  const cairo = needsCairo ? await loadCairoFonts(pdfDoc) : null;

  for (const key of Object.keys(input.fieldPlacements) as (keyof FieldPlacements)[]) {
    const placement = input.fieldPlacements[key];
    let text = FIELD_VALUE_MAP[key](input);

    if (!text) {
      continue;
    }

    const isArabicField = ARABIC_ELIGIBLE_FIELDS[key]?.(input) ?? false;
    let fieldFont = font;
    if (isArabicField && cairo) {
      fieldFont = cairo.regular;
      text = toVisualOrder(text);
    }

    const width = fieldFont.widthOfTextAtSize(text, placement.font_size);
    let x = placement.x;
    if (placement.align === "center") {
      x = placement.x - width / 2;
    } else if (placement.align === "right") {
      x = placement.x - width;
    }

    page.drawText(text, {
      x,
      y: placement.y,
      size: placement.font_size,
      font: fieldFont,
      color: hexToRgb(placement.color),
    });
  }

  return pdfDoc.save();
}
