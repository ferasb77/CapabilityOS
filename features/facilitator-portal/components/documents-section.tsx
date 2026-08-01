"use client";

import { useActionState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGIONS } from "@/features/facilitators/schema";
import type { FacilitatorProfile } from "@/features/facilitators/data";

import { updateFacilitatorProfile, type UpdateFacilitatorProfileResult } from "../actions";
import { CheckboxGroup } from "./checkbox-group";
import { SaveSectionFooter } from "./save-section-footer";

const initialState: UpdateFacilitatorProfileResult = { success: true, savedAt: "" };

type Props = { facilitator: FacilitatorProfile };

export function DocumentsSection({ facilitator }: Props) {
  const boundAction = updateFacilitatorProfile.bind(null, facilitator.id, "documents");
  const [state, action] = useActionState(boundAction, initialState);

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>Passport and visa coverage on file.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-5">
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="passportExpiry">Passport expiry</Label>
            <Input id="passportExpiry" name="passportExpiry" type="date" defaultValue={facilitator.passportExpiry ?? ""} />
          </div>

          <div className="space-y-2">
            <Label>Visa countries</Label>
            <CheckboxGroup name="visaCountries" options={REGIONS} defaultValue={facilitator.visaCountries} />
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <SaveSectionFooter error={!state.success ? state.error : undefined} savedAt={state.success ? state.savedAt || null : null} />
        </CardContent>
      </form>
    </Card>
  );
}
