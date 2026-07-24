import { Calendar, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

import { getFacilitatorById } from "@/features/facilitators/data";
import { getExperienceBySlug } from "@/features/experiences/data";
import { getExperienceMaterials } from "@/features/materials/data";
import { getFacilitatorMaterialSignedUrl, getParticipantMaterialPublicUrl } from "@/features/materials/storage";
import { FacilitatorUploadPanel } from "@/features/materials/components/facilitator-upload-panel";
import { PortalMaterialsList, type SectionedMaterial } from "@/features/materials/components/portal-materials-list";
import { getSessionContext } from "@/infrastructure/session/session-context";

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
  params: Promise<{ id: string; experienceSlug: string }>;
};

export default async function FacilitatorMaterialsPage({ params }: Props) {
  // Authenticated route — this app has no facilitator-specific login (see
  // migration 0018's header comment); "use existing auth" means the same
  // operator session every /dashboard page already requires.
  const session = await getSessionContext();
  const { id, experienceSlug } = await params;

  const [facilitator, experience] = await Promise.all([getFacilitatorById(id), getExperienceBySlug(experienceSlug)]);

  if (!facilitator || !experience) {
    notFound();
  }

  const materials = await getExperienceMaterials(experience.id, "facilitator");

  const sectionedMaterials: SectionedMaterial[] = await Promise.all(
    materials.map(async (material) => {
      let href = material.url ?? "#";
      if (material.materialType === "file" && material.filePath) {
        href =
          material.audience === "facilitator"
            ? await getFacilitatorMaterialSignedUrl(material.filePath)
            : getParticipantMaterialPublicUrl(material.filePath);
      }

      return {
        id: material.id,
        title: material.title,
        description: material.description,
        materialType: material.materialType,
        fileName: material.fileName,
        fileSizeBytes: material.fileSizeBytes,
        mimeType: material.mimeType,
        url: material.url,
        href,
        section: "program" as const,
      };
    })
  );

  return (
    <main className="min-h-screen bg-night px-4 py-10 text-ivory sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.3em] text-gold/70 uppercase">Enable My Growth</p>
        <h1 className="mt-3 font-heading text-2xl font-semibold text-ivory sm:text-3xl">{experience.title}</h1>
        <p className="mt-2 text-muted-foreground">
          Facilitator folder for {facilitator.firstName} {facilitator.lastName}
        </p>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4 text-gold" />
            {formatDateRange(experience.startDate, experience.endDate)}
          </span>
          {experience.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-gold" />
              {experience.venue}
            </span>
          )}
        </div>

        <div className="mt-6">
          <FacilitatorUploadPanel
            facilitatorId={facilitator.id}
            experienceId={experience.id}
            experienceSlug={experience.slug}
            workspaceId={session.workspaceId}
          />
        </div>

        <div className="mt-8">
          <PortalMaterialsList materials={sectionedMaterials} />
        </div>
      </div>
    </main>
  );
}
