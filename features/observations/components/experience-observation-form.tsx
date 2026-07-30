"use client";

import { useEffect, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExperienceObservation } from "../data";

import { saveExperienceObservation } from "../actions";

const AUTOSAVE_DELAY_MS = 2000;

type FieldsState = {
  groupDynamics: string;
  keyThemes: string;
  recommendations: string;
  generalNotes: string;
};

const FIELDS: { key: keyof FieldsState; label: string; placeholder: string }[] = [
  {
    key: "groupDynamics",
    label: "Group Dynamics",
    placeholder: "Describe the overall group energy, interaction patterns, and team cohesion...",
  },
  {
    key: "keyThemes",
    label: "Key Themes",
    placeholder: "What themes emerged during the experience? What resonated most with participants?",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    placeholder: "What would you recommend to improve future delivery of this program?",
  },
  {
    key: "generalNotes",
    label: "General Notes",
    placeholder: "Any other observations, incidents, or context worth recording...",
  },
];

type Props = {
  experienceId: string;
  initialObservation: ExperienceObservation | null;
  defaultFacilitatorName: string;
};

export function ExperienceObservationForm({ experienceId, initialObservation, defaultFacilitatorName }: Props) {
  const [facilitatorName, setFacilitatorName] = useState(initialObservation?.facilitatorName ?? defaultFacilitatorName);
  const [fields, setFields] = useState<FieldsState>({
    groupDynamics: initialObservation?.groupDynamics ?? "",
    keyThemes: initialObservation?.keyThemes ?? "",
    recommendations: initialObservation?.recommendations ?? "",
    generalNotes: initialObservation?.generalNotes ?? "",
  });
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const fieldsRef = useRef(fields);
  const facilitatorNameRef = useRef(facilitatorName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);
  useEffect(() => {
    facilitatorNameRef.current = facilitatorName;
  }, [facilitatorName]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
    };
  }, []);

  function scheduleSave() {
    if (!facilitatorNameRef.current.trim()) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSavingState("saving");
      setError(null);

      const result = await saveExperienceObservation(experienceId, fieldsRef.current, facilitatorNameRef.current);

      if (!result.success) {
        setError(result.error);
        setSavingState("idle");
        return;
      }

      setSavingState("saved");
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
      savedIndicatorRef.current = setTimeout(() => setSavingState("idle"), 3000);
    }, AUTOSAVE_DELAY_MS);
  }

  function handleFieldChange(key: keyof FieldsState, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    scheduleSave();
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Overall Experience Observations</CardTitle>
        <p className="text-xs text-muted-foreground">
          {savingState === "saving" ? "Saving..." : savingState === "saved" ? "Saved" : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="experience-observation-facilitator">Facilitator name</Label>
          <Input
            id="experience-observation-facilitator"
            value={facilitatorName}
            onChange={(event) => {
              setFacilitatorName(event.target.value);
              scheduleSave();
            }}
            className="max-w-sm"
          />
        </div>

        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`experience-observation-${field.key}`}>{field.label}</Label>
            <Textarea
              id={`experience-observation-${field.key}`}
              rows={4}
              placeholder={field.placeholder}
              value={fields[field.key]}
              onChange={(event) => handleFieldChange(field.key, event.target.value)}
            />
          </div>
        ))}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
