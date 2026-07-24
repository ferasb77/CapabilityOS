import { Download, ExternalLink, PlayCircle } from "lucide-react";

import { MaterialTypeIcon, getYouTubeThumbnailUrl, isVideoUrl } from "./material-type-icon";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type PortalCardMaterial = {
  id: string;
  title: string;
  description: string | null;
  materialType: "file" | "link";
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  url: string | null;
  href: string;
};

export function PortalMaterialCard({ material }: { material: PortalCardMaterial }) {
  const isVideo = material.materialType === "link" && material.url ? isVideoUrl(material.url) : false;
  const thumbnailUrl = material.url ? getYouTubeThumbnailUrl(material.url) : null;

  if (isVideo) {
    return (
      <a
        href={material.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-xl border border-border-subtle bg-surface transition-colors hover:border-gold/40"
      >
        <div className="relative flex aspect-video items-center justify-center bg-night">
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external YouTube host, no next/image remote-pattern config for it
            <img src={thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover opacity-70" loading="lazy" />
          )}
          <PlayCircle className="relative size-14 text-gold drop-shadow-lg" strokeWidth={1.5} />
        </div>
        <div className="p-4">
          <p className="font-medium text-ivory">{material.title}</p>
          {material.description && <p className="mt-1 text-sm text-muted-foreground">{material.description}</p>}
        </div>
      </a>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface p-4">
      <MaterialTypeIcon material={material} className="mt-0.5 size-6 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ivory">{material.title}</p>
        {material.description && <p className="mt-1 text-sm text-muted-foreground">{material.description}</p>}
        {material.materialType === "file" && material.fileSizeBytes !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            {material.fileName} · {formatBytes(material.fileSizeBytes)}
          </p>
        )}
        <a
          href={material.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-gold/90"
        >
          {material.materialType === "file" ? (
            <>
              <Download className="size-4" />
              Download
            </>
          ) : (
            <>
              <ExternalLink className="size-4" />
              Open Link
            </>
          )}
        </a>
      </div>
    </div>
  );
}
