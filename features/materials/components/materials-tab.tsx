import type { Material } from "@/features/materials/data";

import { CopyMaterialsLinkButton } from "./copy-materials-link-button";
import { MaterialListEditor } from "./material-list-editor";
import { SendMaterialsLinkButton } from "./send-materials-link-button";

type Props = {
  experienceId: string;
  experienceSlug: string;
  workspaceId: string;
  participantMaterials: Material[];
  facilitatorMaterials: Material[];
  participants: { id: string; fullName: string }[];
};

export function MaterialsTab({
  experienceId,
  experienceSlug,
  workspaceId,
  participantMaterials,
  facilitatorMaterials,
  participants,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-night/40 p-4">
        <CopyMaterialsLinkButton experienceId={experienceId} participants={participants} />
        <SendMaterialsLinkButton
          experienceId={experienceId}
          experienceSlug={experienceSlug}
          participantCount={participants.length}
        />
      </div>

      <MaterialListEditor
        title="Participant Materials"
        description="Shared with registered participants via their personal materials portal."
        addLabel="Add Material"
        section="participant"
        experienceId={experienceId}
        experienceSlug={experienceSlug}
        workspaceId={workspaceId}
        materials={participantMaterials}
      />

      <MaterialListEditor
        title="Facilitator Resources"
        description="Facilitator guides, slide decks, assessment tools, and briefing notes."
        addLabel="Add Resource"
        section="facilitator"
        experienceId={experienceId}
        experienceSlug={experienceSlug}
        workspaceId={workspaceId}
        materials={facilitatorMaterials}
      />
    </div>
  );
}
