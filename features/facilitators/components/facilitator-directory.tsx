"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AVAILABILITY_OPTIONS } from "@/features/facilitators/schema";
import type { FacilitatorSummary } from "@/features/facilitators/data";

import { FacilitatorCard } from "./facilitator-card";

const ALL = "all";

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const items = [{ value: ALL, label: `All ${label}` }, ...options];

  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? ALL)} items={items}>
      <SelectTrigger className="w-full sm:w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Props = {
  facilitators: FacilitatorSummary[];
};

export function FacilitatorDirectory({ facilitators }: Props) {
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const [expertise, setExpertise] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const [certification, setCertification] = useState(ALL);

  const filterOptions = useMemo(() => {
    const regions = new Set<string>();
    const expertiseAreas = new Set<string>();
    const languages = new Set<string>();
    const certifications = new Set<string>();

    for (const facilitator of facilitators) {
      facilitator.regions.forEach((value) => regions.add(value));
      facilitator.expertiseAreas.forEach((value) => expertiseAreas.add(value));
      facilitator.languages.forEach((value) => languages.add(value));
      facilitator.certifications.forEach((value) => certifications.add(value));
    }

    const toOptions = (values: Set<string>) =>
      [...values].sort().map((value) => ({ value, label: value }));

    return {
      regions: toOptions(regions),
      expertiseAreas: toOptions(expertiseAreas),
      languages: toOptions(languages),
      certifications: toOptions(certifications),
    };
  }, [facilitators]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return facilitators.filter((facilitator) => {
      if (availability !== ALL && facilitator.availabilityStatus !== availability) {
        return false;
      }
      if (region !== ALL && !facilitator.regions.includes(region)) {
        return false;
      }
      if (expertise !== ALL && !facilitator.expertiseAreas.includes(expertise)) {
        return false;
      }
      if (language !== ALL && !facilitator.languages.includes(language)) {
        return false;
      }
      if (certification !== ALL && !facilitator.certifications.includes(certification)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        facilitator.fullName,
        facilitator.title ?? "",
        facilitator.organization ?? "",
        ...facilitator.expertiseAreas,
        ...facilitator.certifications,
        ...facilitator.languages,
        ...facilitator.regions,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [facilitators, search, availability, region, expertise, language, certification]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, expertise, certification, language, or region..."
            className="h-9 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Availability"
            value={availability}
            onChange={setAvailability}
            options={AVAILABILITY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <FilterSelect label="Regions" value={region} onChange={setRegion} options={filterOptions.regions} />
          <FilterSelect
            label="Expertise"
            value={expertise}
            onChange={setExpertise}
            options={filterOptions.expertiseAreas}
          />
          <FilterSelect
            label="Languages"
            value={language}
            onChange={setLanguage}
            options={filterOptions.languages}
          />
          <FilterSelect
            label="Certifications"
            value={certification}
            onChange={setCertification}
            options={filterOptions.certifications}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} of {facilitators.length} facilitators
      </p>

      {filtered.length === 0 ? (
        <Card className="bg-surface-elevated">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No facilitators match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((facilitator) => (
            <FacilitatorCard key={facilitator.id} facilitator={facilitator} />
          ))}
        </div>
      )}
    </div>
  );
}
