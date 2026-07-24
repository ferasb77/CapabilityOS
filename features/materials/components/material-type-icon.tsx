import { File, FileSpreadsheet, FileText, Link2, Presentation, Video, type LucideIcon } from "lucide-react";

export type MaterialKind = "pdf" | "ppt" | "word" | "excel" | "video" | "link" | "file";

const YOUTUBE_PATTERN = /(?:youtube\.com|youtu\.be)/i;
const VIMEO_PATTERN = /vimeo\.com/i;

const YOUTUBE_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
];

export function isVideoUrl(url: string): boolean {
  return YOUTUBE_PATTERN.test(url) || VIMEO_PATTERN.test(url);
}

/**
 * YouTube serves a static, no-auth thumbnail for any known video id
 * (`img.youtube.com/vi/{id}/hqdefault.jpg`) — no API call needed. Vimeo has
 * no equivalent unauthenticated static URL (its thumbnails require an
 * oEmbed API round trip), so Vimeo links fall back to the generic
 * play-button treatment rather than adding an extra external fetch for a
 * single-provider thumbnail.
 */
export function getYouTubeThumbnailUrl(url: string): string | null {
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
  }
  return null;
}

function resolveMimeKind(mimeType: string | null): MaterialKind {
  if (!mimeType) {
    return "file";
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return "ppt";
  }
  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword") {
    return "word";
  }
  if (mimeType.includes("spreadsheetml") || mimeType.includes("excel") || mimeType === "text/csv") {
    return "excel";
  }
  return "file";
}

export function resolveMaterialKind(material: {
  materialType: "file" | "link";
  mimeType: string | null;
  url: string | null;
}): MaterialKind {
  if (material.materialType === "link") {
    return material.url && isVideoUrl(material.url) ? "video" : "link";
  }
  return resolveMimeKind(material.mimeType);
}

export const MATERIAL_KIND_ICONS: Record<MaterialKind, LucideIcon> = {
  pdf: FileText,
  ppt: Presentation,
  word: FileText,
  excel: FileSpreadsheet,
  video: Video,
  link: Link2,
  file: File,
};

export function MaterialTypeIcon({
  material,
  className,
}: {
  material: { materialType: "file" | "link"; mimeType: string | null; url: string | null };
  className?: string;
}) {
  const Icon = MATERIAL_KIND_ICONS[resolveMaterialKind(material)];
  return <Icon className={className} />;
}
