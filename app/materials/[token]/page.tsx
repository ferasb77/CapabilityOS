import { Calendar, MapPin } from "lucide-react";

import { getMaterialsByToken } from "@/features/materials/data";
import { getParticipantMaterialPublicUrl } from "@/features/materials/storage";
import { PortalMaterialsList, type SectionedMaterial } from "@/features/materials/components/portal-materials-list";

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };

  if (startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString("en-US", opts);
  }

  return `${startDate.toLocaleDateString("en-US", opts)} – ${endDate.toLocaleDateString("en-US", opts)}`;
}

type Props = {
  params: Promise<{ token: string }>;
};

export default async function MaterialsPortalPage({ params }: Props) {
  const { token } = await params;
  const portalData = await getMaterialsByToken(token);

  if (!portalData) {
    return (
      <main className="min-h-screen bg-night px-4 py-16 text-ivory sm:px-6">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-border-subtle bg-surface p-10 text-center">
          <h1 className="font-heading text-2xl font-semibold text-ivory">Materials link not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This link is invalid or has expired. Please contact Enable My Growth if you believe this is a mistake.
          </p>
        </div>
      </main>
    );
  }

  const materials: SectionedMaterial[] = portalData.materials.map((material) => ({
    id: material.id,
    title: material.title,
    description: material.description,
    materialType: material.materialType,
    fileName: material.fileName,
    fileSizeBytes: material.fileSizeBytes,
    mimeType: material.mimeType,
    url: material.url,
    href:
      material.materialType === "file" && material.filePath
        ? getParticipantMaterialPublicUrl(material.filePath)
        : (material.url ?? "#"),
    section: material.availableFrom === "registration" ? "pre" : "program",
  }));

  return (
    <main className="min-h-screen bg-night px-4 py-10 text-ivory sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.3em] text-gold/70 uppercase">Enable My Growth</p>
        <h1 className="mt-3 font-heading text-2xl font-semibold text-ivory sm:text-3xl">
          {portalData.experienceTitle}
        </h1>
        <p className="mt-2 text-muted-foreground">Welcome, {portalData.participantFirstName}</p>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          {portalData.experienceStartDate && portalData.experienceEndDate && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 text-gold" />
              {formatDateRange(portalData.experienceStartDate, portalData.experienceEndDate)}
            </span>
          )}
          {portalData.experienceVenue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-gold" />
              {portalData.experienceVenue}
            </span>
          )}
        </div>

        <div className="mt-8">
          <PortalMaterialsList materials={materials} />
        </div>
      </div>
    </main>
  );
}
