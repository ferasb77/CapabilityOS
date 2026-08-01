"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ExperienceDetailRecord } from "@/features/experiences/data";

import { updateExperience, type UpdateExperienceResult } from "../actions";
import {
  COUNTRIES,
  EXPERIENCE_STATUS_OPTIONS,
  EXPERIENCE_STATUS_TRANSITIONS,
  EXPERIENCE_TYPE_LABELS,
  EXPERIENCE_TYPES,
} from "../schema";
import { DeleteExperienceDialog } from "./delete-experience-dialog";
import { FacilitatorConflictWarning } from "./facilitator-conflict-warning";

const initialState: UpdateExperienceResult = { success: false, error: "", values: {} };

type ClientOption = { id: string; name: string };
type EngagementOption = { id: string; title: string; clientId: string; clientName: string };
type FacilitatorOption = { id: string; fullName: string; primaryExpertise: string | null };

/** Postgres returns timestamptz as an ISO string with an offset; the value
 * was originally written as a bare datetime-local string (see actions.ts),
 * so slicing back to "YYYY-MM-DDTHH:mm" round-trips exactly — running it
 * through Date getters instead would reinterpret it in the browser's local
 * timezone and could shift the displayed time. */
function toDateTimeLocalValue(iso: string): string {
  return iso.slice(0, 16);
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return <p className="mt-1 text-sm text-destructive">{messages[0]}</p>;
}

function FormSection({
  number,
  title,
  description,
  children,
  columns = true,
}: {
  number: number;
  title: string;
  description: string;
  children: ReactNode;
  columns?: boolean;
}) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-ivory">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-semibold text-night">
            {number}
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={columns ? "grid gap-5 sm:grid-cols-2" : "space-y-5"}>
        {children}
      </CardContent>
    </Card>
  );
}

function StringSelectField({
  name,
  label,
  placeholder,
  options,
  defaultValue,
  disabled,
}: {
  name: string;
  label: string;
  placeholder: string;
  options: readonly string[];
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} defaultValue={defaultValue || undefined} disabled={disabled}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Saving..." : "Save Changes"}
    </Button>
  );
}

type Props = {
  experience: ExperienceDetailRecord;
  clients?: ClientOption[];
  engagements?: EngagementOption[];
  facilitators?: FacilitatorOption[];
  /** id of the facilitator whose email matches experience.facilitatorEmail, if any. */
  currentFacilitatorId?: string;
};

export function ExperienceEditForm({
  experience,
  clients = [],
  engagements = [],
  facilitators = [],
  currentFacilitatorId,
}: Props) {
  const boundUpdateExperience = updateExperience.bind(null, experience.id, experience.slug);
  const [state, action] = useActionState(boundUpdateExperience, initialState);

  const fieldErrors = !state.success ? state.fieldErrors : undefined;
  const errorValues = !state.success ? state.values : undefined;

  const readOnly = experience.status === "completed" || experience.status === "cancelled";
  const canDelete = experience.status === "draft" || experience.status === "cancelled";
  const showClientSection = clients.length > 0 || engagements.length > 0;

  // Falls back to the experience's current value; once the action returns
  // an error, falls back to what the user actually typed instead so it
  // isn't lost. See experience-form.tsx for why the form is remounted (via
  // `key`) on every error — uncontrolled fields only read defaultValue on
  // mount.
  const field = (name: string, fallback: string): string => {
    if (errorValues && name in errorValues) {
      return errorValues[name] ?? "";
    }
    return fallback;
  };

  const formKey = errorValues ? JSON.stringify(errorValues) : "initial";

  const statusOptions = EXPERIENCE_STATUS_OPTIONS.filter((option) =>
    EXPERIENCE_STATUS_TRANSITIONS[experience.status].includes(option.value)
  );

  // Controlled only so the engagement list can be filtered to the selected
  // client — every other field stays uncontrolled/native like the rest of
  // this form.
  const [selectedClientId, setSelectedClientId] = useState(
    field("clientId", experience.clientId ?? "")
  );

  const filteredEngagements = useMemo(
    () => engagements.filter((engagement) => !selectedClientId || engagement.clientId === selectedClientId),
    [engagements, selectedClientId]
  );

  // Controlled for the same reason — feeds the live facilitator
  // unavailability-conflict warning below, which needs to react as either
  // the facilitator or the dates change.
  const [selectedFacilitatorId, setSelectedFacilitatorId] = useState(
    field("facilitatorId", currentFacilitatorId ?? "")
  );
  const [startDateValue, setStartDateValue] = useState(field("startDate", toDateTimeLocalValue(experience.startDate)));
  const [endDateValue, setEndDateValue] = useState(field("endDate", toDateTimeLocalValue(experience.endDate)));

  const [dailyCheckinEnabled, setDailyCheckinEnabled] = useState(
    field("dailyCheckinEnabled", experience.dailyCheckinEnabled ? "true" : "false") === "true"
  );

  return (
    <form key={formKey} action={action} className="space-y-6" noValidate>
      {readOnly && (
        <div className="rounded-lg border border-border-subtle bg-night/40 px-4 py-3 text-sm text-muted-foreground">
          This experience has been {experience.status === "completed" ? "completed" : "cancelled"} and
          cannot be edited.
        </div>
      )}

      {!state.success && state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </div>
      )}

      {showClientSection && (
        <FormSection
          number={1}
          title="Client and Engagement"
          description="Which client and contract this experience belongs to, if any."
        >
          <div className="space-y-2">
            <Label htmlFor="clientId">Client</Label>
            <Select
              name="clientId"
              value={selectedClientId}
              onValueChange={(next) => setSelectedClientId(next ?? "")}
              disabled={readOnly}
              items={clients.map((client) => ({ value: client.id, label: client.name }))}
            >
              <SelectTrigger id="clientId" className="w-full">
                <SelectValue placeholder="No client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="engagementId">Engagement</Label>
            <Select
              key={selectedClientId}
              name="engagementId"
              defaultValue={
                selectedClientId ? field("engagementId", experience.engagementId ?? "") || undefined : undefined
              }
              disabled={readOnly}
              items={filteredEngagements.map((engagement) => ({
                value: engagement.id,
                label: `${engagement.title} — ${engagement.clientName}`,
              }))}
            >
              <SelectTrigger id="engagementId" className="w-full">
                <SelectValue
                  placeholder={
                    selectedClientId ? "No engagement" : "Select a client to see its engagements"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredEngagements.map((engagement) => (
                  <SelectItem key={engagement.id} value={engagement.id}>
                    {engagement.title} — {engagement.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>
      )}

      <FormSection
        number={showClientSection ? 2 : 1}
        title="Program Details"
        description="What this experience is and how it's tagged."
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">
            Title <span className="text-gold">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            required
            disabled={readOnly}
            defaultValue={field("title", experience.title)}
          />
          <FieldError messages={fieldErrors?.title} />
          <p className="text-xs text-muted-foreground">
            URL: /dashboard/experiences/{experience.slug} — the slug is set once and cannot be
            changed.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="titleAr">Arabic Title / العنوان بالعربية</Label>
          <Input
            id="titleAr"
            name="titleAr"
            dir="rtl"
            className="font-cairo placeholder:text-right"
            placeholder="العنوان بالعربية"
            disabled={readOnly}
            defaultValue={field("titleAr", experience.titleAr ?? "")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="experienceType">Experience type</Label>
          <Select
            name="experienceType"
            defaultValue={field("experienceType", experience.experienceType)}
            disabled={readOnly}
            items={EXPERIENCE_TYPES.map((type) => ({ value: type, label: EXPERIENCE_TYPE_LABELS[type] }))}
          >
            <SelectTrigger id="experienceType" className="w-full">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {EXPERIENCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {EXPERIENCE_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            name="status"
            defaultValue={field("status", experience.status)}
            disabled={readOnly}
            items={statusOptions.map((option) => ({ value: option.value, label: option.label }))}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue placeholder="Select a status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            disabled={readOnly}
            defaultValue={field("description", experience.description ?? "")}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            name="tags"
            placeholder="e.g. leadership, executive, arabic-delivery"
            disabled={readOnly}
            defaultValue={field("tags", experience.tags.join(", "))}
          />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>
      </FormSection>

      <FormSection
        number={showClientSection ? 3 : 2}
        title="Schedule and Location"
        description="When and where this experience runs."
      >
        <div className="space-y-2">
          <Label htmlFor="startDate">
            Start date and time <span className="text-gold">*</span>
          </Label>
          <Input
            id="startDate"
            name="startDate"
            type="datetime-local"
            required
            disabled={readOnly}
            defaultValue={field("startDate", toDateTimeLocalValue(experience.startDate))}
            onChange={(event) => setStartDateValue(event.target.value)}
          />
          <FieldError messages={fieldErrors?.startDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">
            End date and time <span className="text-gold">*</span>
          </Label>
          <Input
            id="endDate"
            name="endDate"
            type="datetime-local"
            required
            disabled={readOnly}
            defaultValue={field("endDate", toDateTimeLocalValue(experience.endDate))}
            onChange={(event) => setEndDateValue(event.target.value)}
          />
          <FieldError messages={fieldErrors?.endDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="venueName">
            Venue name <span className="text-gold">*</span>
          </Label>
          <Input
            id="venueName"
            name="venueName"
            required
            disabled={readOnly}
            defaultValue={field("venueName", experience.venue ?? "")}
          />
          <FieldError messages={fieldErrors?.venueName} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            disabled={readOnly}
            defaultValue={field("city", experience.city ?? "")}
          />
        </div>

        <StringSelectField
          name="country"
          label="Country"
          placeholder="Select a country"
          options={COUNTRIES}
          defaultValue={field("country", experience.country ?? "")}
          disabled={readOnly}
        />

        <div className="space-y-2">
          <Label htmlFor="capacity">
            Capacity <span className="text-gold">*</span>
          </Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            required
            disabled={readOnly}
            defaultValue={field("capacity", String(experience.capacity))}
          />
          <FieldError messages={fieldErrors?.capacity} />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border-subtle bg-night/40 p-4 sm:col-span-2">
          <div>
            <Label htmlFor="dailyCheckinEnabledToggle">Enable daily check-in</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              When enabled, participants check in each day of a multi-day experience using the same QR
              code. Attendance is recorded per day.
            </p>
          </div>
          <input type="hidden" name="dailyCheckinEnabled" value={dailyCheckinEnabled ? "true" : "false"} />
          <Switch
            id="dailyCheckinEnabledToggle"
            checked={dailyCheckinEnabled}
            onCheckedChange={setDailyCheckinEnabled}
            disabled={readOnly}
          />
        </div>
      </FormSection>

      <FormSection
        number={showClientSection ? 4 : 3}
        title="Facilitator"
        description="Who is delivering this experience."
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="facilitatorId">Facilitator</Label>
          <Select
            name="facilitatorId"
            defaultValue={field("facilitatorId", currentFacilitatorId ?? "") || undefined}
            onValueChange={(next) => setSelectedFacilitatorId(next ?? "")}
            disabled={readOnly}
            items={facilitators.map((facilitator) => ({
              value: facilitator.id,
              label: facilitator.primaryExpertise
                ? `${facilitator.fullName} — ${facilitator.primaryExpertise}`
                : facilitator.fullName,
            }))}
          >
            <SelectTrigger id="facilitatorId" className="w-full">
              <SelectValue placeholder="No facilitator assigned" />
            </SelectTrigger>
            <SelectContent>
              {facilitators.map((facilitator) => (
                <SelectItem key={facilitator.id} value={facilitator.id}>
                  {facilitator.primaryExpertise
                    ? `${facilitator.fullName} — ${facilitator.primaryExpertise}`
                    : facilitator.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedFacilitatorId && startDateValue && endDateValue && (
          <FacilitatorConflictWarning
            facilitatorId={selectedFacilitatorId}
            startDate={startDateValue}
            endDate={endDateValue}
          />
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="facilitatorNotes">Notes for facilitator</Label>
          <Textarea
            id="facilitatorNotes"
            name="facilitatorNotes"
            rows={3}
            disabled={readOnly}
            defaultValue={field("facilitatorNotes", experience.facilitatorNotes ?? "")}
          />
        </div>
      </FormSection>

      <FormSection
        number={showClientSection ? 5 : 4}
        title="Logistics and Materials"
        description="What needs to be prepared before the day."
        columns={false}
      >
        <div className="space-y-2">
          <Label htmlFor="materialsNotes">Materials notes</Label>
          <Textarea
            id="materialsNotes"
            name="materialsNotes"
            rows={3}
            placeholder="What needs to be prepared, printed, or shipped."
            disabled={readOnly}
            defaultValue={field("materialsNotes", experience.materialsNotes ?? "")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="logisticsNotes">Logistics notes</Label>
          <Textarea
            id="logisticsNotes"
            name="logisticsNotes"
            rows={3}
            placeholder="Venue setup, catering, AV requirements."
            disabled={readOnly}
            defaultValue={field("logisticsNotes", experience.logisticsNotes ?? "")}
          />
        </div>
      </FormSection>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          {canDelete && (
            <DeleteExperienceDialog experienceId={experience.id} className="w-full sm:w-auto" />
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            size="lg"
            nativeButton={false}
            className="w-full sm:w-auto"
            render={<Link href={`/dashboard/experiences/${experience.slug}`} />}
          >
            {readOnly ? "Back" : "Cancel"}
          </Button>
          {!readOnly && <SubmitButton />}
        </div>
      </div>
    </form>
  );
}
