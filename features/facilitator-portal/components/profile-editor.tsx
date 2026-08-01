"use client";

import { useState } from "react";
import { User, Award, Globe, Plane, CheckCircle2, AlertCircle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { updateFacilitatorProfile } from "../actions";
import type { UpdateFacilitatorProfileInput } from "../schema";

const REGION_OPTIONS = [
  "KSA",
  "UAE",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Egypt",
  "Jordan",
  "Lebanon",
  "Other GCC / MENA",
];

const VISA_COUNTRY_OPTIONS = [
  "US (B1/B2)",
  "Schengen Area",
  "UK",
  "Saudi Arabia (GCC Resident / Business)",
  "UAE Residency / Golden Visa",
  "Canada",
];

type Props = {
  facilitator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    photoUrl: string | null;
    bio: string | null;
    title: string | null;
    organization: string | null;
    yearsExperience: number | null;
    expertiseAreas: string[];
    certifications: string[];
    languages: string[];
    regions: string[];
    willingToTravel: boolean;
    travelNotes: string | null;
    passportExpiry: string | null;
    visaCountries: string[];
  };
};

export function ProfileEditor({ facilitator }: Props) {
  // Form State
  const [firstName, setFirstName] = useState(facilitator.firstName);
  const [lastName, setLastName] = useState(facilitator.lastName);
  const [title, setTitle] = useState(facilitator.title ?? "");
  const [organization, setOrganization] = useState(facilitator.organization ?? "");
  const [yearsExperience, setYearsExperience] = useState<number | "">(
    facilitator.yearsExperience ?? ""
  );
  const [bio, setBio] = useState(facilitator.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(facilitator.photoUrl ?? "");

  // Arrays (tag inputs / checkboxes)
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>(facilitator.expertiseAreas);
  const [expertiseInput, setExpertiseInput] = useState("");

  const [certifications, setCertifications] = useState<string[]>(facilitator.certifications);
  const [certInput, setCertInput] = useState("");

  const [languages, setLanguages] = useState<string[]>(facilitator.languages);
  const [langInput, setLangInput] = useState("");

  const [regions, setRegions] = useState<string[]>(facilitator.regions);
  const [willingToTravel, setWillingToTravel] = useState<boolean>(facilitator.willingToTravel);
  const [travelNotes, setTravelNotes] = useState(facilitator.travelNotes ?? "");

  const [passportExpiry, setPassportExpiry] = useState(facilitator.passportExpiry ?? "");
  const [visaCountries, setVisaCountries] = useState<string[]>(facilitator.visaCountries);

  // Status State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddExpertise = () => {
    if (expertiseInput.trim() && !expertiseAreas.includes(expertiseInput.trim())) {
      setExpertiseAreas([...expertiseAreas, expertiseInput.trim()]);
      setExpertiseInput("");
    }
  };

  const handleRemoveExpertise = (item: string) => {
    setExpertiseAreas(expertiseAreas.filter((i) => i !== item));
  };

  const handleAddCert = () => {
    if (certInput.trim() && !certifications.includes(certInput.trim())) {
      setCertifications([...certifications, certInput.trim()]);
      setCertInput("");
    }
  };

  const handleRemoveCert = (item: string) => {
    setCertifications(certifications.filter((i) => i !== item));
  };

  const handleAddLang = () => {
    if (langInput.trim() && !languages.includes(langInput.trim())) {
      setLanguages([...languages, langInput.trim()]);
      setLangInput("");
    }
  };

  const handleRemoveLang = (item: string) => {
    setLanguages(languages.filter((i) => i !== item));
  };

  const toggleRegion = (region: string) => {
    if (regions.includes(region)) {
      setRegions(regions.filter((r) => r !== region));
    } else {
      setRegions([...regions, region]);
    }
  };

  const toggleVisa = (visa: string) => {
    if (visaCountries.includes(visa)) {
      setVisaCountries(visaCountries.filter((v) => v !== visa));
    } else {
      setVisaCountries([...visaCountries, visa]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setErrorMessage(null);

    const payload: UpdateFacilitatorProfileInput = {
      firstName,
      lastName,
      title,
      organization,
      yearsExperience: yearsExperience === "" ? null : Number(yearsExperience),
      bio,
      photoUrl,
      expertiseAreas,
      certifications,
      languages,
      regions,
      willingToTravel,
      travelNotes,
      passportExpiry,
      visaCountries,
    };

    const result = await updateFacilitatorProfile(facilitator.id, payload);

    setIsSaving(false);

    if (result.success) {
      setSaveSuccess(`Profile saved successfully at ${result.lastSavedAt}`);
    } else {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ivory">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Keep your professional background, certifications, and travel documents up to date.
          </p>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2 self-start sm:self-auto">
          <Save className="size-4" />
          {isSaving ? "Saving Changes..." : "Save Profile"}
        </Button>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Personal & Professional Details */}
      <Card className="bg-surface-elevated border-border-subtle">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-ivory flex items-center gap-2">
            <User className="size-5 text-gold" /> Personal & Professional Details
          </CardTitle>
          <CardDescription>
            Basic information displayed on program briefs and facilitator directory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Professional Title</Label>
              <Input
                id="title"
                placeholder="e.g. Senior Leadership Executive Coach"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization / Practice</Label>
              <Input
                id="organization"
                placeholder="e.g. EMG Associate / Independent Consultant"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="yearsExperience">Years of Facilitation Experience</Label>
              <Input
                id="yearsExperience"
                type="number"
                min={0}
                placeholder="e.g. 12"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value ? Number(e.target.value) : "")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photoUrl">Profile Photo URL</Label>
              <Input
                id="photoUrl"
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Biography / Summary</Label>
            <Textarea
              id="bio"
              rows={4}
              placeholder="Brief overview of your background, experience, and delivery style..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Expertise & Certifications */}
      <Card className="bg-surface-elevated border-border-subtle">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-ivory flex items-center gap-2">
            <Award className="size-5 text-gold" /> Expertise & Certifications
          </CardTitle>
          <CardDescription>
            Topics and certifications used for matching you with upcoming client proposals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Expertise Tag Input */}
          <div className="space-y-2">
            <Label>Areas of Expertise</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Executive Coaching, Digital Transformation"
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddExpertise();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddExpertise}>
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {expertiseAreas.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="bg-gold/10 text-gold border-gold/30 hover:bg-gold/20 cursor-pointer"
                  onClick={() => handleRemoveExpertise(item)}
                >
                  {item} <span className="ml-1 font-bold">×</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Certifications Tag Input */}
          <div className="space-y-2">
            <Label>Certifications</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. ICF PCC, Gallup CliftonStrengths Certified"
                value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCert();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddCert}>
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {certifications.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="bg-surface-elevated border-border-subtle text-ivory hover:border-destructive cursor-pointer"
                  onClick={() => handleRemoveCert(item)}
                >
                  {item} <span className="ml-1 font-bold">×</span>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Languages & Regions */}
      <Card className="bg-surface-elevated border-border-subtle">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-ivory flex items-center gap-2">
            <Globe className="size-5 text-gold" /> Languages & Regions
          </CardTitle>
          <CardDescription>Delivery languages and geographic availability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Languages Tag Input */}
          <div className="space-y-2">
            <Label>Delivery Languages</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. English, Arabic (Bilingual), French"
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddLang();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddLang}>
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {languages.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="bg-gold/10 text-gold border-gold/30 hover:bg-gold/20 cursor-pointer"
                  onClick={() => handleRemoveLang(item)}
                >
                  {item} <span className="ml-1 font-bold">×</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Regional Checkboxes */}
          <div className="space-y-2">
            <Label>Primary Delivery Regions</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {REGION_OPTIONS.map((region) => {
                const checked = regions.includes(region);
                return (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-left transition ${
                      checked
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border-subtle bg-night/50 text-muted-foreground hover:text-ivory"
                    }`}
                  >
                    <div
                      className={`size-3.5 rounded flex items-center justify-center border ${
                        checked ? "bg-gold border-gold text-night" : "border-muted-foreground"
                      }`}
                    >
                      {checked && <CheckCircle2 className="size-3" />}
                    </div>
                    {region}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Travel & Documents */}
      <Card className="bg-surface-elevated border-border-subtle">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-ivory flex items-center gap-2">
            <Plane className="size-5 text-gold" /> Travel & Visa Readiness
          </CardTitle>
          <CardDescription>Logistical details for international programs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-night/50 p-4">
            <div>
              <Label className="text-sm font-semibold text-ivory">Willingness to Travel</Label>
              <p className="text-xs text-muted-foreground">
                Available for regional and international on-site workshop deliveries.
              </p>
            </div>
            <Switch checked={willingToTravel} onCheckedChange={setWillingToTravel} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passportExpiry">Passport Expiry Date</Label>
              <Input
                id="passportExpiry"
                type="date"
                value={passportExpiry}
                onChange={(e) => setPassportExpiry(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="travelNotes">Travel Preferences & Notes</Label>
              <Textarea
                id="travelNotes"
                rows={2}
                placeholder="e.g. Preferred airline, dietary preferences..."
                value={travelNotes}
                onChange={(e) => setTravelNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Valid Visas Held</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {VISA_COUNTRY_OPTIONS.map((visa) => {
                const checked = visaCountries.includes(visa);
                return (
                  <button
                    key={visa}
                    type="button"
                    onClick={() => toggleVisa(visa)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-left transition ${
                      checked
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border-subtle bg-night/50 text-muted-foreground hover:text-ivory"
                    }`}
                  >
                    <div
                      className={`size-3.5 rounded flex items-center justify-center border ${
                        checked ? "bg-gold border-gold text-night" : "border-muted-foreground"
                      }`}
                    >
                      {checked && <CheckCircle2 className="size-3" />}
                    </div>
                    {visa}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="size-4" />
              {isSaving ? "Saving..." : "Save All Profile Sections"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
