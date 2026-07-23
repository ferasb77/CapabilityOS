import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityBadge } from "@/features/facilitators/components/availability-badge";
import { DeliveryHistoryPanel } from "@/features/facilitators/components/delivery-history-panel";
import { getFacilitatorById, getFacilitatorDeliveryHistory } from "@/features/facilitators/data";

const SIX_MONTHS_DAYS = 182;

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function passportStatus(expiry: string | null): {
  label: string;
  tone: "default" | "warning" | "danger";
} {
  if (!expiry) {
    return { label: "Not on file", tone: "default" };
  }

  const expiryDate = new Date(`${expiry}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expiryDate.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { label: `Expired ${formatDate(expiry)}`, tone: "danger" };
  }

  if (diffDays <= SIX_MONTHS_DAYS) {
    return { label: `Valid until ${formatDate(expiry)}`, tone: "warning" };
  }

  return { label: `Valid until ${formatDate(expiry)}`, tone: "default" };
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FacilitatorDetailPage({ params }: Props) {
  const { id } = await params;
  const facilitator = await getFacilitatorById(id);

  if (!facilitator) {
    notFound();
  }

  const history = await getFacilitatorDeliveryHistory(facilitator.email);
  const passport = passportStatus(facilitator.passportExpiry);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/dashboard/facilitators"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to facilitators
      </Link>

      <Card className="bg-surface-elevated">
        <CardContent className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <Avatar size="lg">
              {facilitator.photoUrl && (
                <AvatarImage src={facilitator.photoUrl} alt={facilitator.fullName} />
              )}
              <AvatarFallback className="text-lg">
                {initials(facilitator.firstName, facilitator.lastName)}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{facilitator.fullName}</h1>
                <AvailabilityBadge status={facilitator.availabilityStatus} />
              </div>
              {facilitator.title && <p className="mt-1 text-muted-foreground">{facilitator.title}</p>}
              {facilitator.organization && (
                <p className="text-sm text-muted-foreground">{facilitator.organization}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {facilitator.email}
                </span>
                {facilitator.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {facilitator.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href={`/dashboard/facilitators/${facilitator.id}/edit`} />}
          >
            Edit
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {facilitator.bio ? (
            <p className="text-sm text-muted-foreground">{facilitator.bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No bio on file.</p>
          )}
          {facilitator.yearsExperience !== null && (
            <p className="text-sm text-muted-foreground">
              <span className="text-ivory">{facilitator.yearsExperience}</span> years of experience
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Expertise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Expertise areas</p>
            {facilitator.expertiseAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {facilitator.expertiseAreas.map((area) => (
                  <Badge key={area} variant="secondary">
                    {area}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Certifications</p>
            {facilitator.certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {facilitator.certifications.map((cert) => (
                  <Badge key={cert} variant="outline" className="border-gold/40 text-gold">
                    {cert}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Languages and Regions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Languages</p>
            <p className="text-sm text-ivory">
              {facilitator.languages.length > 0 ? facilitator.languages.join(", ") : "—"}
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Regions willing to work in</p>
            <p className="text-sm text-ivory">
              {facilitator.regions.length > 0 ? facilitator.regions.join(", ") : "—"}
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Travel</p>
            <p className="text-sm text-ivory">
              {facilitator.willingToTravel ? "Willing to travel" : "Not willing to travel"}
            </p>
          </div>
          {facilitator.travelNotes && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Travel notes</p>
              <p className="text-sm text-ivory">{facilitator.travelNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Passport</p>
            <p
              className={
                passport.tone === "danger"
                  ? "text-sm font-medium text-destructive"
                  : passport.tone === "warning"
                    ? "text-sm font-medium text-amber-400"
                    : "text-sm text-ivory"
              }
            >
              {passport.label}
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Visa countries</p>
            {facilitator.visaCountries.length === 0 ? (
              <p className="text-sm text-ivory">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {facilitator.visaCountries.map((country) => (
                  <Badge key={country} variant="secondary">
                    {country}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <AvailabilityBadge status={facilitator.availabilityStatus} />
          {facilitator.availabilityNotes && (
            <p className="text-sm text-muted-foreground">{facilitator.availabilityNotes}</p>
          )}
        </CardContent>
      </Card>

      <DeliveryHistoryPanel history={history} />
    </div>
  );
}
