"use client";

import { useActionState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FacilitatorProfile } from "@/features/facilitators/data";

import { updateFacilitatorProfile, type UpdateFacilitatorProfileResult } from "../actions";
import { SaveSectionFooter } from "./save-section-footer";

const initialState: UpdateFacilitatorProfileResult = { success: true, savedAt: "" };

type Props = { facilitator: FacilitatorProfile };

export function PersonalProfessionalSection({ facilitator }: Props) {
  const boundAction = updateFacilitatorProfile.bind(null, facilitator.id, "personal");
  const [state, action] = useActionState(boundAction, initialState);
  const fieldErrors = !state.success ? state.fieldErrors : undefined;

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Personal and Professional</CardTitle>
        <CardDescription>Who you are and how coordinators should describe you.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required defaultValue={facilitator.firstName} />
            {fieldErrors?.firstName && <p className="text-sm text-destructive">{fieldErrors.firstName[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" required defaultValue={facilitator.lastName} />
            {fieldErrors?.lastName && <p className="text-sm text-destructive">{fieldErrors.lastName[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={facilitator.title ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization">Organization</Label>
            <Input id="organization" name="organization" defaultValue={facilitator.organization ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="yearsExperience">Years of experience</Label>
            <Input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              defaultValue={facilitator.yearsExperience?.toString() ?? ""}
            />
            {fieldErrors?.yearsExperience && <p className="text-sm text-destructive">{fieldErrors.yearsExperience[0]}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bio">Biography</Label>
            <Textarea id="bio" name="bio" rows={4} defaultValue={facilitator.bio ?? ""} />
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <SaveSectionFooter error={!state.success ? state.error : undefined} savedAt={state.success ? state.savedAt || null : null} />
        </CardContent>
      </form>
    </Card>
  );
}
