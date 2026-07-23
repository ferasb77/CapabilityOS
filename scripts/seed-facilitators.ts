/**
 * Facilitator directory demo seed for WorkshopOS.
 *
 * Run with: npx tsx scripts/seed-facilitators.ts
 *
 * Inserts 12 realistic regional facilitator profiles. Also backfills
 * `facilitator_name` / `facilitator_email` on a subset of the existing demo
 * workshops (scripts/seed-demo.ts) so the directory's "workshops delivered"
 * and "average satisfaction" figures — and the detail page's delivery
 * history — have real data to show instead of every facilitator reading
 * zero. workshops.facilitator_email has no FK to facilitators.email; the
 * match is by-value only, same as the rest of the app.
 *
 * Safe to re-run: facilitators are looked up by email first and skipped if
 * they already exist; the workshop backfill is a deterministic UPDATE keyed
 * by slug, so re-applying it is a no-op.
 */

import path from "node:path";

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(import.meta.dirname, "..", ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env. Aborting.");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env. This script needs the service role key " +
      "to bypass RLS (find it in Supabase → Project Settings → API). Aborting."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type AvailabilityStatus = "available" | "partially_available" | "unavailable";

type FacilitatorSeed = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  organization: string;
  yearsExperience: number;
  bio: string;
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
  /** Demo workshop slugs (from scripts/seed-demo.ts) this facilitator delivered. */
  assignedWorkshopSlugs: string[];
};

const FACILITATORS: FacilitatorSeed[] = [
  {
    firstName: "Layla",
    lastName: "Al-Sayed",
    email: "layla.alsayed@emgfacilitators.com",
    phone: "+966501234501",
    title: "Senior Leadership Consultant",
    organization: "Independent Consultant",
    yearsExperience: 14,
    bio: "Layla partners with executive teams across the Gulf on leadership development and succession planning, with a particular focus on first-time people leaders.",
    expertiseAreas: ["Leadership Development", "Executive Coaching"],
    certifications: ["Hogan Certified Assessor", "ICF PCC"],
    languages: ["Arabic", "English"],
    regions: ["KSA", "UAE", "Qatar"],
    willingToTravel: true,
    travelNotes: "Prefers Gulf-region travel; needs 3 weeks notice for international.",
    passportExpiry: "2029-04-12",
    visaCountries: ["UAE", "Qatar", "Bahrain"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-leadership-essentials-mar26"],
  },
  {
    firstName: "Omar",
    lastName: "Haddad",
    email: "omar.haddad@kenexamena.com",
    phone: "+971501234502",
    title: "Principal Consultant, Change & Transformation",
    organization: "Kenexa Middle East",
    yearsExperience: 11,
    bio: "Omar leads large-scale change management engagements for regional conglomerates, blending Hogan-based assessment with practical change frameworks.",
    expertiseAreas: ["Hogan Assessment", "Change Management"],
    certifications: ["Hogan Certified Assessor", "Korn Ferry Certified"],
    languages: ["Arabic", "English"],
    regions: ["UAE", "KSA", "Bahrain"],
    willingToTravel: true,
    travelNotes: null,
    passportExpiry: "2028-09-30",
    visaCountries: ["KSA", "Bahrain", "Kuwait"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-change-management-fundamentals-jun26"],
  },
  {
    firstName: "Rania",
    lastName: "Farouk",
    email: "rania.farouk@designforwardmena.com",
    phone: "+201001234503",
    title: "Design Thinking Facilitator",
    organization: "Design Forward MENA",
    yearsExperience: 8,
    bio: "Rania designs and facilitates innovation sprints for corporate teams, drawing on a background in industrial design and human-centred research.",
    expertiseAreas: ["Design Thinking", "Facilitation Skills"],
    certifications: ["ICF ACC", "DISC Certified"],
    languages: ["Arabic", "English", "French"],
    regions: ["Egypt", "Jordan", "Lebanon"],
    willingToTravel: true,
    travelNotes: "Based in Cairo; can travel within the Levant with two weeks notice.",
    passportExpiry: "2027-11-05",
    visaCountries: ["Jordan", "Lebanon"],
    availabilityStatus: "partially_available",
    availabilityNotes: "Booked through September for an internal client program.",
    assignedWorkshopSlugs: ["demo-executive-presence-communication-aug26"],
  },
  {
    firstName: "James",
    lastName: "Anderson",
    email: "james.anderson@meridianadvisory.com",
    phone: "+971501234504",
    title: "Strategy & Leadership Advisor",
    organization: "Meridian Advisory",
    yearsExperience: 17,
    bio: "James advises C-suite leaders on strategic thinking and organizational change, having relocated to Dubai after 12 years in London-based consulting.",
    expertiseAreas: ["Strategic Thinking", "Change Management"],
    certifications: ["ICF PCC", "MBTI Certified"],
    languages: ["English"],
    regions: ["UAE", "KSA", "Qatar", "Kuwait"],
    willingToTravel: true,
    travelNotes: null,
    passportExpiry: "2030-02-18",
    visaCountries: ["KSA", "Qatar", "Kuwait"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-strategic-thinking-executives-apr26"],
  },
  {
    firstName: "Nour",
    lastName: "Khoury",
    email: "nour.khoury@catalystcoaching.com",
    phone: "+961701234505",
    title: "Executive Coach",
    organization: "Catalyst Coaching",
    yearsExperience: 10,
    bio: "Nour coaches senior leaders on emotional intelligence and self-awareness, with a coaching practice spanning Lebanon, Jordan, and Egypt.",
    expertiseAreas: ["Emotional Intelligence", "Executive Coaching"],
    certifications: ["ICF PCC", "DISC Certified"],
    languages: ["Arabic", "English", "French"],
    regions: ["Lebanon", "Jordan", "Egypt"],
    willingToTravel: true,
    travelNotes: null,
    passportExpiry: "2028-06-22",
    visaCountries: ["Jordan", "Egypt"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-coaching-skills-managers-may26"],
  },
  {
    firstName: "Khalid",
    lastName: "Al-Otaibi",
    email: "khalid.alotaibi@visionleadership.sa",
    phone: "+966501234506",
    title: "Leadership Development Partner",
    organization: "Vision Leadership Institute",
    yearsExperience: 13,
    bio: "Khalid designs leadership curricula for Saudi enterprises undergoing rapid growth, aligning development programs with Vision 2030 talent priorities.",
    expertiseAreas: ["Leadership Development", "Strategic Thinking"],
    certifications: ["Korn Ferry Certified", "Hogan Certified Assessor"],
    languages: ["Arabic", "English"],
    regions: ["KSA", "Bahrain", "Kuwait"],
    willingToTravel: true,
    travelNotes: null,
    passportExpiry: "2029-01-15",
    visaCountries: ["Bahrain", "Kuwait"],
    availabilityStatus: "partially_available",
    availabilityNotes: "Available weekends and the last week of each month only.",
    assignedWorkshopSlugs: ["demo-high-performance-teams-jun26"],
  },
  {
    firstName: "Sarah",
    lastName: "Mitchell",
    email: "sarah.mitchell@brightpathfacilitation.com",
    phone: "+974501234507",
    title: "Senior Facilitator",
    organization: "Brightpath Facilitation",
    yearsExperience: 9,
    bio: "Sarah facilitates cross-functional workshops on presentation skills and design thinking for clients across Qatar and the wider Gulf.",
    expertiseAreas: ["Facilitation Skills", "Design Thinking"],
    certifications: ["MBTI Certified", "ICF ACC"],
    languages: ["English"],
    regions: ["Qatar", "UAE", "Bahrain"],
    willingToTravel: true,
    travelNotes: null,
    passportExpiry: "2027-08-09",
    visaCountries: ["UAE", "Bahrain"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-presentation-skills-advanced-jul26"],
  },
  {
    firstName: "Yousef",
    lastName: "Al-Amin",
    email: "yousef.alamin@hoganassessmentsmena.com",
    phone: "+971501234508",
    title: "Hogan Assessment Specialist",
    organization: "Hogan Assessments MENA",
    yearsExperience: 12,
    bio: "Yousef is a certified Hogan assessor delivering leadership debrief programs and psychometric-based coaching across the Gulf.",
    expertiseAreas: ["Hogan Assessment", "Executive Coaching"],
    certifications: ["Hogan Certified Assessor", "ICF PCC"],
    languages: ["Arabic", "English"],
    regions: ["UAE", "KSA", "Qatar", "Kuwait", "Bahrain"],
    willingToTravel: true,
    travelNotes: "Passport renewal in progress — confirm before booking international travel.",
    passportExpiry: "2027-01-10",
    visaCountries: ["KSA", "Qatar", "Kuwait", "Bahrain"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-hogan-debrief-masterclass-apr26"],
  },
  {
    firstName: "Dana",
    lastName: "Al-Qasimi",
    email: "dana.alqasimi@shiftconsulting.qa",
    phone: "+974501234509",
    title: "Change & Culture Consultant",
    organization: "Shift Consulting",
    yearsExperience: 7,
    bio: "Dana works with HR and transformation leaders on change readiness and emotional intelligence programs for public and private sector clients.",
    expertiseAreas: ["Change Management", "Emotional Intelligence"],
    certifications: ["DISC Certified", "ICF ACC"],
    languages: ["Arabic", "English"],
    regions: ["Qatar", "KSA", "UAE"],
    willingToTravel: false,
    travelNotes: "Currently only delivering within Doha.",
    passportExpiry: null,
    visaCountries: [],
    availabilityStatus: "unavailable",
    availabilityNotes: "On parental leave until further notice.",
    assignedWorkshopSlugs: [],
  },
  {
    firstName: "Michael",
    lastName: "Bennett",
    email: "michael.bennett@meridianadvisory.com",
    phone: "+201001234510",
    title: "Regional Lead, Strategy Practice",
    organization: "Meridian Advisory",
    yearsExperience: 16,
    bio: "Michael leads Meridian's strategy practice across North Africa and the Levant, specialising in leadership alignment for scaling organizations.",
    expertiseAreas: ["Strategic Thinking", "Leadership Development"],
    certifications: ["MBTI Certified", "Korn Ferry Certified"],
    languages: ["English", "French"],
    regions: ["Egypt", "Jordan", "Lebanon"],
    willingToTravel: true,
    travelNotes: "Passport renewal recommended before Q1 travel.",
    passportExpiry: "2026-12-20",
    visaCountries: ["Jordan", "Lebanon"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-facilitation-mastery-oct26"],
  },
  {
    firstName: "Huda",
    lastName: "Mahmoud",
    email: "huda.mahmoud@designforwardmena.com",
    phone: "+966501234511",
    title: "Facilitation & Design Thinking Lead",
    organization: "Design Forward MENA",
    yearsExperience: 6,
    bio: "Huda runs innovation and design thinking workshops for enterprise teams in Riyadh, with a growing practice across the wider Gulf.",
    expertiseAreas: ["Design Thinking", "Facilitation Skills"],
    certifications: ["ICF ACC", "DISC Certified"],
    languages: ["Arabic", "English"],
    regions: ["KSA", "UAE"],
    willingToTravel: true,
    travelNotes: null,
    passportExpiry: "2028-03-27",
    visaCountries: ["UAE"],
    availabilityStatus: "partially_available",
    availabilityNotes: "Available Sunday-Tuesday only through year end.",
    assignedWorkshopSlugs: ["demo-design-thinking-innovation-aug26"],
  },
  {
    firstName: "Rami",
    lastName: "Barakat",
    email: "rami.barakat@catalystcoaching.com",
    phone: "+961701234512",
    title: "Executive Coach & Facilitator",
    organization: "Catalyst Coaching",
    yearsExperience: 15,
    bio: "Rami combines executive coaching and emotional intelligence facilitation for leadership teams across the Levant and Gulf.",
    expertiseAreas: ["Executive Coaching", "Emotional Intelligence"],
    certifications: ["ICF PCC", "MBTI Certified"],
    languages: ["Arabic", "English", "French"],
    regions: ["Lebanon", "Jordan", "Egypt", "Qatar"],
    willingToTravel: true,
    travelNotes: null,
    passportExpiry: "2029-10-02",
    visaCountries: ["Jordan", "Egypt", "Qatar"],
    availabilityStatus: "available",
    availabilityNotes: null,
    assignedWorkshopSlugs: ["demo-emotional-intelligence-leadership-may26"],
  },
];

async function main() {
  console.log("WorkshopOS facilitator directory seed");
  console.log("======================================\n");

  console.log("Inserting facilitators...");

  const { data: existingRows, error: existingError } = await supabase
    .from("facilitators")
    .select("email");

  if (existingError) {
    console.error(`Failed to check existing facilitators: ${existingError.message}`);
    process.exit(1);
  }

  const existingEmails = new Set((existingRows ?? []).map((row) => row.email.toLowerCase()));

  let newFacilitatorCount = 0;
  const assignments: { slug: string; firstName: string; lastName: string; email: string }[] = [];

  for (const facilitator of FACILITATORS) {
    for (const slug of facilitator.assignedWorkshopSlugs) {
      assignments.push({
        slug,
        firstName: facilitator.firstName,
        lastName: facilitator.lastName,
        email: facilitator.email,
      });
    }

    if (existingEmails.has(facilitator.email.toLowerCase())) {
      console.log(`  - ${facilitator.firstName} ${facilitator.lastName} already exists, skipping`);
      continue;
    }

    const { error } = await supabase.from("facilitators").insert({
      first_name: facilitator.firstName,
      last_name: facilitator.lastName,
      email: facilitator.email,
      phone: facilitator.phone,
      title: facilitator.title,
      organization: facilitator.organization,
      years_experience: facilitator.yearsExperience,
      bio: facilitator.bio,
      expertise_areas: facilitator.expertiseAreas,
      certifications: facilitator.certifications,
      languages: facilitator.languages,
      regions: facilitator.regions,
      willing_to_travel: facilitator.willingToTravel,
      travel_notes: facilitator.travelNotes,
      passport_expiry: facilitator.passportExpiry,
      visa_countries: facilitator.visaCountries,
      availability_status: facilitator.availabilityStatus,
      availability_notes: facilitator.availabilityNotes,
    });

    if (error) {
      console.error(`Failed to insert facilitator "${facilitator.firstName} ${facilitator.lastName}": ${error.message}`);
      process.exit(1);
    }

    newFacilitatorCount += 1;
    console.log(`  + ${facilitator.firstName} ${facilitator.lastName} (${facilitator.availabilityStatus})`);
  }

  console.log("\nAssigning facilitators to existing demo workshops...");

  let assignedCount = 0;

  for (const assignment of assignments) {
    const { data: updated, error } = await supabase
      .from("workshops")
      .update({
        facilitator_name: `${assignment.firstName} ${assignment.lastName}`,
        facilitator_email: assignment.email,
      })
      .eq("slug", assignment.slug)
      .select("id");

    if (error) {
      console.error(`Failed to assign facilitator to workshop "${assignment.slug}": ${error.message}`);
      process.exit(1);
    }

    if (!updated || updated.length === 0) {
      console.log(`  - Workshop "${assignment.slug}" not found, skipping assignment`);
      continue;
    }

    assignedCount += 1;
    console.log(`  + ${assignment.slug} -> ${assignment.firstName} ${assignment.lastName}`);
  }

  console.log("\nDone.");
  console.log("Summary");
  console.log("-------");
  console.log(`Facilitators inserted: ${newFacilitatorCount} (of ${FACILITATORS.length} planned)`);
  console.log(`Workshops assigned:    ${assignedCount} (of ${assignments.length} planned)`);
}

main().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
