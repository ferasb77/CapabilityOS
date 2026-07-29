// Server-side file type validation via magic bytes. Declared MIME types
// (File.type) come from the browser and are trivially spoofable, so every
// upload path that persists a file must verify it against the bytes
// actually received instead of trusting the client's Content-Type.
//
// The `file-type` npm package is ESM-only and breaks this project's build,
// so signatures are checked by hand — sufficient here because the accepted
// formats (PDF, JPEG, PNG, and the ZIP-based Office Open XML formats) all
// have short, unambiguous magic-byte headers.

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "image/jpeg",
  "image/png",
] as const;

export type FileValidationResult = { valid: true; detectedType: string } | { valid: false; detectedType: "unknown" };

/**
 * Office Open XML files (pptx/docx/xlsx) are ZIP containers, so the magic
 * bytes alone can't distinguish between them — the declared MIME type is
 * trusted for those only after the ZIP signature confirms the container
 * format is genuine.
 */
export async function validateFileType(
  file: File,
  allowedTypes: readonly string[] = ALLOWED_UPLOAD_MIME_TYPES
): Promise<FileValidationResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 8));

  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return allowedTypes.includes("application/pdf") ? { valid: true, detectedType: "application/pdf" } : { valid: false, detectedType: "unknown" };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return allowedTypes.includes("image/jpeg") ? { valid: true, detectedType: "image/jpeg" } : { valid: false, detectedType: "unknown" };
  }

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return allowedTypes.includes("image/png") ? { valid: true, detectedType: "image/png" } : { valid: false, detectedType: "unknown" };
  }

  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const declaredType = file.type;
    if (allowedTypes.includes(declaredType)) {
      return { valid: true, detectedType: declaredType };
    }
  }

  return { valid: false, detectedType: "unknown" };
}
