/**
 * Demo data seed for WorkshopOS.
 *
 * Run with: npx tsx scripts/seed-demo.ts
 *
 * Inserts a realistic HNI-style demo portfolio — workshops, participants,
 * survey tokens, and survey responses — without touching the real
 * "ai-powered-design-thinking" workshop or its 6 real participants.
 *
 * Safe to re-run, including after a partial failure: each phase (workshops,
 * participants, survey tokens, survey responses) is resolved independently
 * against what's already in the database. A workshop whose slug already
 * exists is not re-inserted, but if it doesn't have participants yet (e.g.
 * a previous run failed partway through), participants are still inserted
 * for it — and the same per-workshop check applies to survey tokens and
 * survey responses.
 */

import { randomUUID } from "node:crypto";
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

// ---------------------------------------------------------------------------
// Random data helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const ARABIC_MALE_FIRST = [
  "Ahmed", "Mohammed", "Omar", "Khalid", "Faisal", "Yousef", "Abdullah",
  "Hassan", "Tariq", "Karim", "Rami", "Nasser", "Saeed", "Fahad", "Waleed",
  "Sultan", "Majed", "Bandar",
] as const;

const ARABIC_FEMALE_FIRST = [
  "Fatima", "Aisha", "Layla", "Noura", "Sara", "Mariam", "Hind", "Rania",
  "Dana", "Reem", "Yasmin", "Huda", "Salma", "Lina", "Amal", "Nour", "Rawan",
] as const;

const ARABIC_LAST = [
  "Al-Rashid", "Al-Mansour", "Al-Sayed", "Hassan", "Khoury", "Farouk",
  "Al-Otaibi", "Al-Qasimi", "Nasser", "Haddad", "Al-Zahrani", "Mahmoud",
  "Saleh", "Al-Amin", "Barakat", "Al-Harbi", "Fakhoury",
] as const;

const WESTERN_MALE_FIRST = [
  "James", "Michael", "Robert", "David", "Christopher", "Daniel", "Matthew",
  "Andrew", "Joshua", "Ryan", "Thomas", "William",
] as const;

const WESTERN_FEMALE_FIRST = [
  "Jennifer", "Jessica", "Sarah", "Emily", "Amanda", "Michelle", "Laura",
  "Rachel", "Nicole", "Stephanie", "Elizabeth", "Victoria",
] as const;

const WESTERN_LAST = [
  "Anderson", "Thompson", "Wilson", "Clark", "Robinson", "Walker", "Turner",
  "Phillips", "Campbell", "Parker", "Mitchell", "Bennett",
] as const;

const COMPANIES = [
  "Saudi Aramco", "SABIC", "Emirates NBD", "Qatar Airways", "Ooredoo", "Zain",
  "Majid Al Futtaim", "Emaar", "ADNOC", "Almarai", "Riyad Bank",
  "Commercial Bank of Qatar", "Etihad Airways", "du Telecom", "Agthia Group",
] as const;

const JOB_TITLES = [
  "Senior Manager", "Director", "VP Operations", "HR Business Partner",
  "Head of Learning", "Chief of Staff", "General Manager", "Team Leader",
  "Senior Consultant",
] as const;

const COUNTRY_DIAL_CODE: Record<string, string> = {
  "Saudi Arabia": "966",
  UAE: "971",
  Egypt: "20",
  Qatar: "974",
  Lebanon: "961",
  Kuwait: "965",
  Jordan: "962",
};

let emailCounter = 0;

function makeParticipant(country: string) {
  const isArabic = Math.random() < 0.65;
  const isMale = Math.random() < 0.5;

  const firstName = isArabic
    ? pick(isMale ? ARABIC_MALE_FIRST : ARABIC_FEMALE_FIRST)
    : pick(isMale ? WESTERN_MALE_FIRST : WESTERN_FEMALE_FIRST);
  const lastName = isArabic ? pick(ARABIC_LAST) : pick(WESTERN_LAST);

  emailCounter += 1;
  const email = `${slugify(firstName)}.${slugify(lastName)}${emailCounter}@demo.workshopos.com`;

  const dialCode = COUNTRY_DIAL_CODE[country] ?? "971";
  const mobile = `+${dialCode}5${randomInt(1000000, 9999999)}`;

  return {
    firstName,
    lastName,
    email,
    mobile,
    company: pick(COMPANIES),
    jobTitle: pick(JOB_TITLES),
  };
}

const HIGHLIGHTS = [
  "The practical frameworks I can apply immediately with my team.",
  "Real-world case studies that mirrored challenges we face day to day.",
  "The facilitator's energy and ability to keep the room engaged.",
  "Breakout discussions with peers from other departments.",
  "The clarity of the leadership models presented.",
  "Hands-on exercises rather than just theory.",
  "Networking with other managers across the region.",
  "The coaching techniques I can use in my next one-on-one.",
  "How the content was tailored to our industry context.",
  "The balance between individual reflection and group work.",
] as const;

const IMPROVEMENTS = [
  "More time for Q&A at the end of each session.",
  "A longer session — two days felt rushed for this much content.",
  "More follow-up materials to reinforce the learning afterward.",
  "Smaller breakout groups for deeper discussion.",
  "An earlier start time would have suited our schedules better.",
  "More region-specific examples rather than global case studies.",
  "A pre-workshop survey to tailor content to our needs.",
  "Better pacing — some modules felt rushed near the end.",
  "More time for peer networking during breaks.",
  "Printed materials in addition to the digital slides.",
] as const;

const ADDITIONAL_COMMENTS = [
  "Looking forward to the next session in this series.",
  "Would recommend this to colleagues in other departments.",
  "One of the better external trainings I've attended this year.",
  "Great venue and organisation overall.",
  null,
  null,
  null,
] as const;

/** Samples an integer 1-5 with a triangular spread around `target`. */
function sampleRatingAround(target: number): number {
  const noise = (Math.random() - Math.random()) * 1.4;
  return Math.min(5, Math.max(1, Math.round(target + noise)));
}

// ---------------------------------------------------------------------------
// Seed plan
// ---------------------------------------------------------------------------

type WorkshopPlan = {
  slug: string;
  title: string;
  venue: string;
  country: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  status: "completed" | "active" | "draft" | "cancelled";
  capacity: number;
  participantCount: number;
  checkedInRate: number; // 0-1
  /** Only meaningful for completed workshops. */
  surveys: "full" | "none";
};

function dateRange(start: string, end: string) {
  return {
    startDate: `${start}T09:00:00+00:00`,
    endDate: `${end}T17:00:00+00:00`,
  };
}

const WORKSHOPS: WorkshopPlan[] = [
  // Completed (8) — 6 with full survey data, 2 with none sent yet.
  {
    slug: "demo-leadership-essentials-mar26",
    title: "Leadership Essentials",
    venue: "Riyadh, Saudi Arabia",
    country: "Saudi Arabia",
    ...dateRange("2026-03-10", "2026-03-11"),
    status: "completed",
    capacity: 25,
    participantCount: 22,
    checkedInRate: 0.95,
    surveys: "full",
  },
  {
    slug: "demo-hogan-debrief-masterclass-apr26",
    title: "Hogan Assessment Debrief Masterclass",
    venue: "Dubai, UAE",
    country: "UAE",
    ...dateRange("2026-04-14", "2026-04-15"),
    status: "completed",
    capacity: 25,
    participantCount: 25,
    checkedInRate: 0.95,
    surveys: "full",
  },
  {
    slug: "demo-strategic-thinking-executives-apr26",
    title: "Strategic Thinking for Executives",
    venue: "Cairo, Egypt",
    country: "Egypt",
    ...dateRange("2026-04-28", "2026-04-29"),
    status: "completed",
    capacity: 20,
    participantCount: 19,
    checkedInRate: 0.95,
    surveys: "full",
  },
  {
    slug: "demo-coaching-skills-managers-may26",
    title: "Coaching Skills for Managers",
    venue: "Doha, Qatar",
    country: "Qatar",
    ...dateRange("2026-05-12", "2026-05-13"),
    status: "completed",
    capacity: 25,
    participantCount: 23,
    checkedInRate: 0.95,
    surveys: "full",
  },
  {
    slug: "demo-emotional-intelligence-leadership-may26",
    title: "Emotional Intelligence in Leadership",
    venue: "Beirut, Lebanon",
    country: "Lebanon",
    ...dateRange("2026-05-26", "2026-05-27"),
    status: "completed",
    capacity: 20,
    participantCount: 17,
    checkedInRate: 0.95,
    surveys: "full",
  },
  {
    slug: "demo-change-management-fundamentals-jun26",
    title: "Change Management Fundamentals",
    venue: "Abu Dhabi, UAE",
    country: "UAE",
    ...dateRange("2026-06-09", "2026-06-10"),
    status: "completed",
    capacity: 25,
    participantCount: 25,
    checkedInRate: 0.95,
    surveys: "full",
  },
  {
    slug: "demo-high-performance-teams-jun26",
    title: "High Performance Teams",
    venue: "Kuwait City, Kuwait",
    country: "Kuwait",
    ...dateRange("2026-06-23", "2026-06-24"),
    status: "completed",
    capacity: 22,
    participantCount: 21,
    checkedInRate: 0.95,
    surveys: "none",
  },
  {
    slug: "demo-presentation-skills-advanced-jul26",
    title: "Presentation Skills Advanced",
    venue: "Amman, Jordan",
    country: "Jordan",
    ...dateRange("2026-07-07", "2026-07-08"),
    status: "completed",
    capacity: 20,
    participantCount: 18,
    checkedInRate: 0.95,
    surveys: "none",
  },

  // Active / published (6) — none have started yet, so 0 checked in.
  // "Design Thinking for Innovation" is deliberately near capacity
  // (13 of 15) to produce the "approaching capacity" attention flag; the
  // other five are filled exactly to capacity so they don't also fire it.
  {
    slug: "demo-design-thinking-innovation-aug26",
    title: "Design Thinking for Innovation",
    venue: "Dubai, UAE",
    country: "UAE",
    ...dateRange("2026-08-11", "2026-08-12"),
    status: "active",
    capacity: 15,
    participantCount: 13,
    checkedInRate: 0,
    surveys: "none",
  },
  {
    slug: "demo-executive-presence-communication-aug26",
    title: "Executive Presence and Communication",
    venue: "Riyadh, Saudi Arabia",
    country: "Saudi Arabia",
    ...dateRange("2026-08-25", "2026-08-26"),
    status: "active",
    capacity: 15,
    participantCount: 15,
    checkedInRate: 0,
    surveys: "none",
  },
  {
    slug: "demo-conflict-resolution-negotiation-sep26",
    title: "Conflict Resolution and Negotiation",
    venue: "Cairo, Egypt",
    country: "Egypt",
    ...dateRange("2026-09-08", "2026-09-09"),
    status: "active",
    capacity: 15,
    participantCount: 15,
    checkedInRate: 0,
    surveys: "none",
  },
  {
    slug: "demo-women-in-leadership-sep26",
    title: "Women in Leadership Program",
    venue: "Doha, Qatar",
    country: "Qatar",
    ...dateRange("2026-09-22", "2026-09-23"),
    status: "active",
    capacity: 15,
    participantCount: 15,
    checkedInRate: 0,
    surveys: "none",
  },
  {
    slug: "demo-digital-leadership-transformation-oct26",
    title: "Digital Leadership Transformation",
    venue: "Beirut, Lebanon",
    country: "Lebanon",
    ...dateRange("2026-10-06", "2026-10-07"),
    status: "active",
    capacity: 12,
    participantCount: 12,
    checkedInRate: 0,
    surveys: "none",
  },
  {
    slug: "demo-facilitation-mastery-oct26",
    title: "Facilitation Mastery",
    venue: "Abu Dhabi, UAE",
    country: "UAE",
    ...dateRange("2026-10-20", "2026-10-21"),
    status: "active",
    capacity: 15,
    participantCount: 15,
    checkedInRate: 0,
    surveys: "none",
  },

  // Draft (3) — not yet published, no participants.
  {
    slug: "demo-advanced-hogan-certification-nov26",
    title: "Advanced Hogan Certification Program",
    venue: "Riyadh, Saudi Arabia",
    country: "Saudi Arabia",
    ...dateRange("2026-11-10", "2026-11-11"),
    status: "draft",
    capacity: 20,
    participantCount: 0,
    checkedInRate: 0,
    surveys: "none",
  },
  {
    slug: "demo-organizational-culture-by-design-dec26",
    title: "Organizational Culture by Design",
    venue: "Dubai, UAE",
    country: "UAE",
    ...dateRange("2026-12-01", "2026-12-02"),
    status: "draft",
    capacity: 20,
    participantCount: 0,
    checkedInRate: 0,
    surveys: "none",
  },
  {
    slug: "demo-strategic-hr-business-partnering-dec26",
    title: "Strategic HR Business Partnering",
    venue: "Cairo, Egypt",
    country: "Egypt",
    ...dateRange("2026-12-15", "2026-12-16"),
    status: "draft",
    capacity: 20,
    participantCount: 0,
    checkedInRate: 0,
    surveys: "none",
  },

  // Cancelled (1).
  {
    slug: "demo-crisis-leadership-simulation-jun26",
    title: "Crisis Leadership Simulation",
    venue: "Kuwait City, Kuwait",
    country: "Kuwait",
    ...dateRange("2026-06-16", "2026-06-17"),
    status: "cancelled",
    capacity: 20,
    participantCount: 5,
    checkedInRate: 0,
    surveys: "none",
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type WorkshopContext = WorkshopPlan & { id: string };
type ParticipantContext = { id: string; first_name: string; workshopSlug: string };
type CompletedTokenContext = { id: string; participantId: string; workshopId: string };

/** Realistic check-in timestamp. `checked_in_at` is NOT NULL, so unchecked
 * participants get the workshop's start time rather than null. */
function checkedInAtFor(workshop: Pick<WorkshopPlan, "startDate">, checkedIn: boolean): string {
  if (!checkedIn) {
    return workshop.startDate;
  }

  return new Date(new Date(workshop.startDate).getTime() + randomInt(0, 60) * 60_000).toISOString();
}

async function main() {
  console.log("WorkshopOS demo seed");
  console.log("=====================\n");

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", "enable-my-growth")
    .maybeSingle();

  if (orgError) {
    console.error(`Failed to look up organization: ${orgError.message}`);
    process.exit(1);
  }

  if (!org) {
    console.error(
      "No organization found with slug 'enable-my-growth'. Run migration 0001 and seed " +
        "that organization before seeding demo data. Aborting."
    );
    process.exit(1);
  }

  console.log(`Using organization: ${org.name} (${org.id})`);
  console.log(
    "Note: workshops/participants don't carry organization_id yet (deferred to the " +
      "multi-tenancy audit) — this lookup is just a sanity check that we're pointed at " +
      "the right project.\n"
  );

  // ---------------------------------------------------------------------
  // Phase 1: workshops — resolve an id for every planned workshop, only
  // inserting the ones that don't already exist.
  // ---------------------------------------------------------------------
  console.log("Inserting workshops...");

  const { data: existingWorkshopRows, error: existingWorkshopsError } = await supabase
    .from("workshops")
    .select("id, slug")
    .like("slug", "demo-%");

  if (existingWorkshopsError) {
    console.error(`Failed to check existing demo workshops: ${existingWorkshopsError.message}`);
    process.exit(1);
  }

  const existingWorkshopIdBySlug = new Map(
    (existingWorkshopRows ?? []).map((w) => [w.slug, w.id])
  );

  const workshops: WorkshopContext[] = [];
  let newWorkshopCount = 0;

  for (const plan of WORKSHOPS) {
    const existingId = existingWorkshopIdBySlug.get(plan.slug);

    if (existingId) {
      workshops.push({ ...plan, id: existingId });
      console.log(`  - ${plan.title} already exists, skipping`);
      continue;
    }

    const id = randomUUID();

    const { error } = await supabase.from("workshops").insert({
      id,
      title: plan.title,
      slug: plan.slug,
      description: `${plan.title} — an Enable My Growth executive workshop.`,
      venue: plan.venue,
      start_date: plan.startDate,
      end_date: plan.endDate,
      capacity: plan.capacity,
      status: plan.status,
    });

    if (error) {
      console.error(`Failed to insert workshop "${plan.title}": ${error.message}`);
      process.exit(1);
    }

    workshops.push({ ...plan, id });
    newWorkshopCount += 1;
    console.log(`  + ${plan.title} (${plan.status})`);
  }

  // ---------------------------------------------------------------------
  // Phase 2: participants — resolved per workshop. A workshop that already
  // has at least one participant is skipped; one with none yet (e.g. a
  // previous run failed before reaching it) still gets participants
  // inserted even though the workshop row itself already existed.
  // ---------------------------------------------------------------------
  console.log("\nInserting participants...");

  const demoSlugs = workshops.map((w) => w.slug);
  const { data: existingParticipantRows, error: existingParticipantsError } = await supabase
    .from("participants")
    .select("id, first_name, workshop_slug")
    .in("workshop_slug", demoSlugs);

  if (existingParticipantsError) {
    console.error(
      `Failed to check existing demo participants: ${existingParticipantsError.message}`
    );
    process.exit(1);
  }

  const participantsBySlug = new Map<string, ParticipantContext[]>();
  for (const row of existingParticipantRows ?? []) {
    const bucket = participantsBySlug.get(row.workshop_slug) ?? [];
    bucket.push({ id: row.id, first_name: row.first_name, workshopSlug: row.workshop_slug });
    participantsBySlug.set(row.workshop_slug, bucket);
  }

  let newParticipantCount = 0;

  for (const workshop of workshops) {
    if (workshop.participantCount === 0) {
      continue;
    }

    if (participantsBySlug.has(workshop.slug)) {
      console.log(`  - Participants for ${workshop.title} already exist, skipping`);
      continue;
    }

    console.log(`  Inserting participants for ${workshop.title}...`);

    const rows = Array.from({ length: workshop.participantCount }, () => {
      const person = makeParticipant(workshop.country);
      const checkedIn = Math.random() < workshop.checkedInRate;

      return {
        id: randomUUID(),
        workshop_slug: workshop.slug,
        first_name: person.firstName,
        last_name: person.lastName,
        email: person.email,
        mobile: person.mobile,
        company: person.company,
        job_title: person.jobTitle,
        checked_in: checkedIn,
        checked_in_at: checkedInAtFor(workshop, checkedIn),
        source: "QR" as const,
      };
    });

    const { error } = await supabase.from("participants").insert(rows);

    if (error) {
      console.error(`Failed to insert participants for "${workshop.title}": ${error.message}`);
      process.exit(1);
    }

    participantsBySlug.set(
      workshop.slug,
      rows.map((row) => ({
        id: row.id,
        first_name: row.first_name,
        workshopSlug: row.workshop_slug,
      }))
    );
    newParticipantCount += rows.length;
  }

  // ---------------------------------------------------------------------
  // Phase 3: survey tokens — only for the completed workshops flagged
  // "full", resolved per workshop the same way as participants.
  // ---------------------------------------------------------------------
  console.log("\nInserting survey tokens...");

  const surveyedWorkshops = workshops.filter(
    (w) => w.status === "completed" && w.surveys === "full"
  );
  const surveyedWorkshopIds = surveyedWorkshops.map((w) => w.id);

  let existingTokenRows: {
    id: string;
    participant_id: string;
    workshop_id: string;
    completed_at: string | null;
  }[] = [];

  if (surveyedWorkshopIds.length > 0) {
    const { data, error } = await supabase
      .from("survey_tokens")
      .select("id, participant_id, workshop_id, completed_at")
      .in("workshop_id", surveyedWorkshopIds);

    if (error) {
      console.error(`Failed to check existing survey tokens: ${error.message}`);
      process.exit(1);
    }

    existingTokenRows = data ?? [];
  }

  const completedTokensByWorkshopId = new Map<string, CompletedTokenContext[]>();
  const workshopIdsWithTokens = new Set<string>();

  for (const row of existingTokenRows) {
    workshopIdsWithTokens.add(row.workshop_id);

    if (row.completed_at) {
      const bucket = completedTokensByWorkshopId.get(row.workshop_id) ?? [];
      bucket.push({ id: row.id, participantId: row.participant_id, workshopId: row.workshop_id });
      completedTokensByWorkshopId.set(row.workshop_id, bucket);
    }
  }

  let newTokenCount = 0;

  for (const workshop of surveyedWorkshops) {
    if (workshopIdsWithTokens.has(workshop.id)) {
      console.log(`  - Survey tokens for ${workshop.title} already exist, skipping`);
      continue;
    }

    console.log(`  Inserting survey tokens for ${workshop.title}...`);

    const participants = participantsBySlug.get(workshop.slug) ?? [];
    const completionRate = randomInt(70, 85) / 100;

    const rows = participants.map((participant) => {
      const isCompleted = Math.random() < completionRate;
      const isOpened = isCompleted || Math.random() < 0.5;
      const sentAt = new Date(
        new Date(workshop.endDate).getTime() + randomInt(1, 3) * 24 * 60 * 60_000
      );

      return {
        id: randomUUID(),
        participant_id: participant.id,
        workshop_id: workshop.id,
        sent_at: sentAt.toISOString(),
        opened_at: isOpened
          ? new Date(sentAt.getTime() + randomInt(10, 600) * 60_000).toISOString()
          : null,
        completed_at: isCompleted
          ? new Date(sentAt.getTime() + randomInt(20, 900) * 60_000).toISOString()
          : null,
        isCompleted,
      };
    });

    const dbRows = rows.map((row) => ({
      id: row.id,
      participant_id: row.participant_id,
      workshop_id: row.workshop_id,
      sent_at: row.sent_at,
      opened_at: row.opened_at,
      completed_at: row.completed_at,
    }));

    const { error } = await supabase.from("survey_tokens").insert(dbRows);

    if (error) {
      console.error(`Failed to insert survey tokens for "${workshop.title}": ${error.message}`);
      process.exit(1);
    }

    completedTokensByWorkshopId.set(
      workshop.id,
      rows
        .filter((row) => row.isCompleted)
        .map((row) => ({ id: row.id, participantId: row.participant_id, workshopId: workshop.id }))
    );
    newTokenCount += rows.length;
  }

  // ---------------------------------------------------------------------
  // Phase 4: survey responses — one per completed token, resolved per
  // workshop so a workshop that already has responses is skipped.
  // ---------------------------------------------------------------------
  console.log("\nInserting survey responses...");

  let existingResponseRows: { workshop_id: string }[] = [];

  if (surveyedWorkshopIds.length > 0) {
    const { data, error } = await supabase
      .from("survey_responses")
      .select("workshop_id")
      .in("workshop_id", surveyedWorkshopIds);

    if (error) {
      console.error(`Failed to check existing survey responses: ${error.message}`);
      process.exit(1);
    }

    existingResponseRows = data ?? [];
  }

  const workshopIdsWithResponses = new Set(existingResponseRows.map((r) => r.workshop_id));
  let newResponseCount = 0;

  for (const workshop of surveyedWorkshops) {
    if (workshopIdsWithResponses.has(workshop.id)) {
      console.log(`  - Survey responses for ${workshop.title} already exist, skipping`);
      continue;
    }

    const tokens = completedTokensByWorkshopId.get(workshop.id) ?? [];

    if (tokens.length === 0) {
      continue;
    }

    console.log(`  Inserting survey responses for ${workshop.title}...`);

    const contentTarget = 3.8 + Math.random() * 1.1; // 3.8-4.9
    const facilitatorTarget = 4.0 + Math.random() * 1.0; // 4.0-5.0
    const logisticsTarget = 3.5 + Math.random() * 1.3; // 3.5-4.8
    const overallTarget = 3.9 + Math.random() * 1.0; // 3.9-4.9

    const rows = tokens.map((token) => ({
      id: randomUUID(),
      token_id: token.id,
      workshop_id: workshop.id,
      participant_id: token.participantId,
      content_rating: sampleRatingAround(contentTarget),
      facilitator_rating: sampleRatingAround(facilitatorTarget),
      logistics_rating: sampleRatingAround(logisticsTarget),
      overall_rating: sampleRatingAround(overallTarget),
      highlights: pick(HIGHLIGHTS),
      improvements: pick(IMPROVEMENTS),
      additional_comments: pick(ADDITIONAL_COMMENTS),
    }));

    const { error } = await supabase.from("survey_responses").insert(rows);

    if (error) {
      console.error(`Failed to insert survey responses for "${workshop.title}": ${error.message}`);
      process.exit(1);
    }

    newResponseCount += rows.length;
  }

  console.log("\nDone.");
  console.log("Summary (this run)");
  console.log("-------------------");
  console.log(`Workshops inserted:    ${newWorkshopCount} (of ${WORKSHOPS.length} planned)`);
  console.log(`Participants inserted: ${newParticipantCount}`);
  console.log(`Survey tokens inserted: ${newTokenCount}`);
  console.log(`Survey responses inserted: ${newResponseCount}`);
}

main().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
