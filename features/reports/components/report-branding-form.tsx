"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ReportBranding } from "../data";
import { previewReportBranding, type SaveReportBrandingResult } from "../actions";

const initialState: SaveReportBrandingResult = { success: false, error: "" };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return <p className="mt-1 text-sm text-destructive">{messages[0]}</p>;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving..." : "Save Branding"}
    </Button>
  );
}

function ColorField({
  id,
  name,
  label,
  defaultValue,
  error,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error?: string[];
}) {
  const [value, setValue] = useState(defaultValue);
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex ? value : "#000000"}
          onChange={(event) => setValue(event.target.value)}
          aria-label={`${label} swatch`}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border-subtle bg-transparent p-1"
        />
        <Input id={id} name={name} value={value} onChange={(event) => setValue(event.target.value)} />
      </div>
      <FieldError messages={error} />
    </div>
  );
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type Props = {
  action: (prevState: SaveReportBrandingResult | null, formData: FormData) => Promise<SaveReportBrandingResult>;
  branding: ReportBranding;
  existingLogoUrl: string | null;
};

export function ReportBrandingForm({ action, branding, existingLogoUrl }: Props) {
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = !state.success ? state.fieldErrors : undefined;
  const formRef = useRef<HTMLFormElement>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function handlePreview() {
    if (!formRef.current) {
      return;
    }

    setIsPreviewing(true);
    setPreviewError(null);

    try {
      const formData = new FormData(formRef.current);
      const result = await previewReportBranding(formData);

      if (!result.success) {
        setPreviewError(result.error);
        return;
      }

      const bytes = base64ToBytes(result.base64);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setIsPreviewing(false);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate>
      {!state.success && state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </div>
      )}

      <input type="hidden" name="existingLogoPath" value={branding.logoPath ?? ""} />

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Who this report is prepared by.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="organizationName">
              Organization name <span className="text-gold">*</span>
            </Label>
            <Input id="organizationName" name="organizationName" required defaultValue={branding.organizationName} />
            <FieldError messages={fieldErrors?.organizationName} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="organizationTagline">Tagline</Label>
            <Input
              id="organizationTagline"
              name="organizationTagline"
              defaultValue={branding.organizationTagline ?? ""}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="logo">Logo</Label>
            <div className="flex flex-wrap items-center gap-3">
              {existingLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={existingLogoUrl}
                  alt="Current logo"
                  className="h-12 max-w-[120px] rounded border border-border-subtle bg-white object-contain p-1"
                />
              )}
              <input
                type="file"
                id="logo"
                name="logo"
                accept="image/png,image/jpeg"
                onChange={(event) => setLogoFileName(event.target.files?.[0]?.name ?? null)}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border-subtle file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-ivory"
              />
            </div>
            {logoFileName && <p className="text-xs text-muted-foreground">Selected: {logoFileName}</p>}
            <p className="text-xs text-muted-foreground">PNG or JPG, max 2MB.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>Applied to the cover, headers, and accents throughout the report.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <ColorField
            id="primaryColor"
            name="primaryColor"
            label="Primary color"
            defaultValue={branding.primaryColor}
            error={fieldErrors?.primaryColor}
          />
          <ColorField
            id="secondaryColor"
            name="secondaryColor"
            label="Secondary color"
            defaultValue={branding.secondaryColor}
            error={fieldErrors?.secondaryColor}
          />
          <ColorField
            id="accentColor"
            name="accentColor"
            label="Accent color"
            defaultValue={branding.accentColor}
            error={fieldErrors?.accentColor}
          />
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Contact &amp; footer</CardTitle>
          <CardDescription>Shown on the cover and closing pages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" defaultValue={branding.website ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={branding.contactEmail ?? ""} />
            <FieldError messages={fieldErrors?.contactEmail} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="footerText">Footer text</Label>
            <Textarea id="footerText" name="footerText" rows={3} defaultValue={branding.footerText ?? ""} />
          </div>
        </CardContent>
      </Card>

      {previewError && <p className="text-sm text-destructive">{previewError}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isPreviewing}
          onClick={handlePreview}
          className="w-full sm:w-auto"
        >
          <Eye className="size-4" />
          {isPreviewing ? "Generating..." : "Preview"}
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
