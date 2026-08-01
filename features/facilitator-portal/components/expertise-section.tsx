"use client";

import { useActionState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TagInput } from "@/features/facilitators/components/tag-input";
import type { FacilitatorProfile } from "@/features/facilitators/data";

import { updateFacilitatorProfile, type UpdateFacilitatorProfileResult } from "../actions";
import { SaveSectionFooter } from "./save-section-footer";

const initialState: UpdateFacilitatorProfileResult = { success: true, savedAt: "" };

type Props = { facilitator: FacilitatorProfile };

export function ExpertiseSection({ facilitator }: Props) {
  const boundAction = updateFacilitatorProfile.bind(null, facilitator.id, "expertise");
  const [state, action] = useActionState(boundAction, initialState);

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Expertise and Certifications</CardTitle>
        <CardDescription>What you specialize in and how you&apos;re credentialed.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-5">
          <TagInput name="expertiseAreas" label="Expertise areas" placeholder="e.g. Leadership Development" defaultValue={facilitator.expertiseAreas} />
          <TagInput name="certifications" label="Certifications" placeholder="e.g. Hogan Certified Assessor" defaultValue={facilitator.certifications} />
        </CardContent>
        <CardContent className="pt-0">
          <SaveSectionFooter error={!state.success ? state.error : undefined} savedAt={state.success ? state.savedAt || null : null} />
        </CardContent>
      </form>
    </Card>
  );
}
