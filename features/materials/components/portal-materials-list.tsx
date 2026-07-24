import { PortalMaterialCard, type PortalCardMaterial } from "./portal-material-card";

type SectionedMaterial = PortalCardMaterial & { section: "pre" | "program" };

export function PortalMaterialsList({ materials }: { materials: SectionedMaterial[] }) {
  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-8 text-center">
        <p className="text-muted-foreground">No materials have been shared yet. Check back closer to the program date.</p>
      </div>
    );
  }

  const preMaterials = materials.filter((material) => material.section === "pre");
  const programMaterials = materials.filter((material) => material.section === "program");
  const isMixed = preMaterials.length > 0 && programMaterials.length > 0;

  if (!isMixed) {
    return (
      <div className="space-y-3">
        {materials.map((material) => (
          <PortalMaterialCard key={material.id} material={material} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {preMaterials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Pre-Program Materials</h2>
          {preMaterials.map((material) => (
            <PortalMaterialCard key={material.id} material={material} />
          ))}
        </div>
      )}
      {programMaterials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Program Materials</h2>
          {programMaterials.map((material) => (
            <PortalMaterialCard key={material.id} material={material} />
          ))}
        </div>
      )}
    </div>
  );
}

export type { SectionedMaterial };
