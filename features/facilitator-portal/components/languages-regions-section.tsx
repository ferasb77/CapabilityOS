"use client";

import { useActionState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/features/facilitators/components/tag-input";
import { REGIONS } from "@/features/facilitators/schema";
import type { FacilitatorProfile } from "@/features/facilitators/data";

import { updateFacilitatorProfile, type UpdateFacilitatorProfileResult } from "../actions";
import { CheckboxGroup } from "./checkbox-group";
import { SaveSectionFooter } from "./save-section-footer";

const initialState: UpdateFacilitatorProfileResult = { success: true, savedAt: "" };

type Props = { facilitator: FacilitatorProfile };

export function LanguagesRegionsSection({ facilitator }: Props) {
  const boundAction = updateFacilitatorProfile.bind(null, facilitator.id, "languages");
  const [state, action] = useActionState(boundAction, initialState);

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Languages and Regions</CardTitle>
        <CardDescription>Where and in what languages you can deliver.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-5">
          <TagInput name="languages" label="Languages" placeholder="e.g. Arabic" defaultValue={facilitator.languages} />

          <div className="space-y-2">
            <Label>Regions</Label>
            <CheckboxGroup name="regions" options={REGIONS} defaultValue={facilitator.regions} />
          </div>

          <label className="flex items-center gap-2 text-sm text-ivory">
            <input
              type="checkbox"
              name="willingToTravel"
              defaultChecked={facilitator.willingToTravel}
              className="size-4 rounded border-input accent-gold"
            />
            Willing to travel
          </label>

          <div className="space-y-2">
            <Label htmlFor="travelNotes">Travel notes</Label>
            <Textarea id="travelNotes" name="travelNotes" rows={2} defaultValue={facilitator.travelNotes ?? ""} />
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <SaveSectionFooter error={!state.success ? state.error : undefined} savedAt={state.success ? state.savedAt || null : null} />
        </CardContent>
      </form>
    </Card>
  );
}
