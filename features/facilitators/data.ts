import { createClient } from "@/infrastructure/supabase/server";

export type AvailabilityStatus = "available" | "partially_available" | "unavailable";

// ---------------------------------------------------------------------------
// Directory summary
// ---------------------------------------------------------------------------

export type FacilitatorSummary = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string | null;
  organization: string | null;
  photoUrl: string | null;
  availabilityStatus: AvailabilityStatus;
  expertiseAreas: string[];
  certifications: string[];
  languages: string[];
  regions: string[];
  workshopsDelivered: number;
  averageSatisfaction: number | null;
};

type FacilitatorSummaryRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string | null;
  organization: string | null;
  photo_url: string | null;
  availability_status: AvailabilityStatus;
  expertise_areas: string[] | null;
  certifications: string[] | null;
  languages: string[] | null;
  regions: string[] | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export async function getAllFacilitators(): Promise<FacilitatorSummary[]> {
  const supabase = await createClient();

  const [facilitatorsResult, workshopsResult, responsesResult] = await Promise.all([
    supabase
      .from("facilitators")
      .select(
        "id, first_name, last_name, email, title, organization, photo_url, availability_status, expertise_areas, certifications, languages, regions"
      )
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
    supabase.from("workshops").select("id, facilitator_email").not("facilitator_email", "is", null),
    supabase.from("survey_responses").select("workshop_id, overall_rating"),
  ]);

  if (facilitatorsResult.error) {
    throw new Error(facilitatorsResult.error.message);
  }

  if (workshopsResult.error) {
    throw new Error(workshopsResult.error.message);
  }

  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }

  const ratingsByWorkshopId = new Map<string, number[]>();
  for (const row of responsesResult.data ?? []) {
    const bucket = ratingsByWorkshopId.get(row.workshop_id) ?? [];
    bucket.push(row.overall_rating);
    ratingsByWorkshopId.set(row.workshop_id, bucket);
  }

  const workshopIdsByEmail = new Map<string, string[]>();
  for (const row of workshopsResult.data ?? []) {
    if (!row.facilitator_email) {
      continue;
    }
    const key = row.facilitator_email.toLowerCase();
    const bucket = workshopIdsByEmail.get(key) ?? [];
    bucket.push(row.id);
    workshopIdsByEmail.set(key, bucket);
  }

  const rows: FacilitatorSummaryRow[] = facilitatorsResult.data ?? [];

  return rows.map((row) => {
    const workshopIds = workshopIdsByEmail.get(row.email.toLowerCase()) ?? [];
    const ratings = workshopIds.flatMap((id) => ratingsByWorkshopId.get(id) ?? []);

    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`,
      title: row.title,
      organization: row.organization,
      photoUrl: row.photo_url,
      availabilityStatus: row.availability_status,
      expertiseAreas: row.expertise_areas ?? [],
      certifications: row.certifications ?? [],
      languages: row.languages ?? [],
      regions: row.regions ?? [],
      workshopsDelivered: workshopIds.length,
      averageSatisfaction: average(ratings),
    };
  });
}

// ---------------------------------------------------------------------------
// Full profile
// ---------------------------------------------------------------------------

export type FacilitatorProfile = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
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
  availabilityStatus: AvailabilityStatus;
  availabilityNotes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FacilitatorProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  bio: string | null;
  title: string | null;
  organization: string | null;
  years_experience: number | null;
  expertise_areas: string[] | null;
  certifications: string[] | null;
  languages: string[] | null;
  regions: string[] | null;
  willing_to_travel: boolean;
  travel_notes: string | null;
  passport_expiry: string | null;
  visa_countries: string[] | null;
  availability_status: AvailabilityStatus;
  availability_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapProfile(row: FacilitatorProfileRow): FacilitatorProfile {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email,
    phone: row.phone,
    photoUrl: row.photo_url,
    bio: row.bio,
    title: row.title,
    organization: row.organization,
    yearsExperience: row.years_experience,
    expertiseAreas: row.expertise_areas ?? [],
    certifications: row.certifications ?? [],
    languages: row.languages ?? [],
    regions: row.regions ?? [],
    willingToTravel: row.willing_to_travel,
    travelNotes: row.travel_notes,
    passportExpiry: row.passport_expiry,
    visaCountries: row.visa_countries ?? [],
    availabilityStatus: row.availability_status,
    availabilityNotes: row.availability_notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getFacilitatorById(id: string): Promise<FacilitatorProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitators")
    .select(
      "id, first_name, last_name, email, phone, photo_url, bio, title, organization, years_experience, expertise_areas, certifications, languages, regions, willing_to_travel, travel_notes, passport_expiry, visa_countries, availability_status, availability_notes, is_active, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapProfile(data as FacilitatorProfileRow);
}

// ---------------------------------------------------------------------------
// Delivery history
// ---------------------------------------------------------------------------

export type FacilitatorDeliveryWorkshop = {
  id: string;
  slug: string;
  title: string;
  startDate: string;
  venue: string | null;
  participantCount: number;
  satisfactionScore: number | null;
};

export type FacilitatorDeliveryHistory = {
  totalWorkshops: number;
  averageSatisfaction: number | null;
  workshops: FacilitatorDeliveryWorkshop[];
};

export async function getFacilitatorDeliveryHistory(
  email: string
): Promise<FacilitatorDeliveryHistory> {
  const supabase = await createClient();

  const { data: workshopRows, error: workshopsError } = await supabase
    .from("workshops")
    .select("id, slug, title, start_date, venue, facilitator_email")
    .not("facilitator_email", "is", null);

  if (workshopsError) {
    throw new Error(workshopsError.message);
  }

  const normalizedEmail = email.toLowerCase();
  const matched = (workshopRows ?? []).filter(
    (row) => row.facilitator_email?.toLowerCase() === normalizedEmail
  );

  if (matched.length === 0) {
    return { totalWorkshops: 0, averageSatisfaction: null, workshops: [] };
  }

  const workshopIds = matched.map((row) => row.id);
  const slugs = matched.map((row) => row.slug);

  const [participantsResult, responsesResult] = await Promise.all([
    supabase.from("participants").select("workshop_slug").in("workshop_slug", slugs),
    supabase.from("survey_responses").select("workshop_id, overall_rating").in("workshop_id", workshopIds),
  ]);

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }

  const participantCountBySlug = new Map<string, number>();
  for (const row of participantsResult.data ?? []) {
    participantCountBySlug.set(
      row.workshop_slug,
      (participantCountBySlug.get(row.workshop_slug) ?? 0) + 1
    );
  }

  const ratingsByWorkshopId = new Map<string, number[]>();
  for (const row of responsesResult.data ?? []) {
    const bucket = ratingsByWorkshopId.get(row.workshop_id) ?? [];
    bucket.push(row.overall_rating);
    ratingsByWorkshopId.set(row.workshop_id, bucket);
  }

  const workshops: FacilitatorDeliveryWorkshop[] = matched
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      startDate: row.start_date,
      venue: row.venue,
      participantCount: participantCountBySlug.get(row.slug) ?? 0,
      satisfactionScore: average(ratingsByWorkshopId.get(row.id) ?? []),
    }))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const allRatings = workshopIds.flatMap((id) => ratingsByWorkshopId.get(id) ?? []);

  return {
    totalWorkshops: workshops.length,
    averageSatisfaction: average(allRatings),
    workshops,
  };
}
