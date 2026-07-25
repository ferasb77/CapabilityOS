/**
 * Historical operations seed for CapabilityOS — Sprint 22.
 *
 * Run with: npx tsx scripts/seed-historical.ts
 *
 * Simulates 5 years (2020-2024) of HNI operations for 5 major existing demo
 * clients, so the intelligence layer has enough depth and variety to surface
 * real patterns: year-over-year satisfaction trends, a COVID volume dip,
 * facilitator-client affinity, seasonal experience clustering, and
 * type-driven rating differences.
 *
 * Does NOT create clients, facilitators, or 2026 engagements — those already
 * exist (scripts/seed-clients-engagements.ts, scripts/seed-facilitators.ts,
 * scripts/seed-demo.ts). This script only looks them up by name/email and
 * links new historical engagements/experiences/participants/surveys to them.
 *
 * Idempotent per (client, year): each historical engagement's title encodes
 * the client and year, e.g. "Saudi Aramco 2020 Training Program". If that
 * engagement already exists AND already has experiences under it, the whole
 * client-year is skipped. If the engagement exists but has zero experiences
 * (a previous run failed partway through), experiences are seeded under the
 * existing engagement rather than creating a duplicate. Every experience
 * slug carries a "demo-hist-" prefix so this run's rows are identifiable
 * and never collide with the 2026 "demo-*" rows from scripts/seed-demo.ts.
 *
 * All row ids are generated client-side (randomUUID from node:crypto) so
 * every phase — experiences, participants, survey tokens, survey responses —
 * can be built and inserted in a handful of batched calls per client-year,
 * with no dependency on insert order or extra round-trips to re-fetch ids.
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

const YEARS = [2020, 2021, 2022, 2023, 2024] as const;

// ---------------------------------------------------------------------------
// Generic random / sampling helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

/** Box-Muller transform — one standard-normal sample. */
function sampleStandardNormal(): number {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clampRating(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

/** Normal(target, 0.5) clamped to 1-5. `outlier` pulls the mean sharply down
 * to model the "5% disgruntled participant" case from the brief. */
function sampleRating(target: number, offset: number, outlier: boolean): number {
  const mean = outlier ? target - (1.5 + Math.random() * 0.8) : target + offset;
  return clampRating(mean + sampleStandardNormal() * 0.5);
}

function weightedIndex(weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function weightedPick<T>(items: readonly { value: T; weight: number }[]): T {
  const index = weightedIndex(items.map((i) => i.weight));
  return items[index].value;
}

/** Round-robins through a pool in call order — guarantees full coverage
 * before any repeat, per the brief's "rotate through, don't repeat" rule. */
function makeRotator<T>(pool: readonly T[]): () => T {
  let i = 0;
  return () => pool[i++ % pool.length];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateOnly(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function insertChunked<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  size = 500
): Promise<void> {
  for (const batch of chunk(rows, size)) {
    if (batch.length === 0) continue;
    // supabase-js's excess-property check on `.insert()` can't resolve a
    // generic `T[]` batch shape against its per-table row types when the
    // client isn't parameterized with a generated Database type — the
    // shape is correct (each `T` here always matches its target table's
    // columns), so this cast is narrowly scoped to that mismatch.
    const { error } = await supabase.from(table).insert(batch as Record<string, unknown>[]);
    if (error) {
      throw new Error(`Failed to insert into ${table}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared text pools
// ---------------------------------------------------------------------------

const HIGHLIGHTS_POOL = [
  "Practical tools I can apply immediately",
  "Excellent facilitator engagement",
  "Real-world case studies",
  "Interactive exercises",
  "Relevant to our industry",
  "Small group discussions",
  "Clear and structured content",
  "Thought-provoking activities",
  "Good balance of theory and practice",
  "Networking with peers",
  "Expert facilitator knowledge",
  "Applicable frameworks",
  "Hands-on learning approach",
  "Relevant examples",
  "Strong facilitation style",
] as const;

const IMPROVEMENTS_POOL = [
  "More time for practice",
  "Additional industry examples",
  "Longer duration needed",
  "Better venue facilities",
  "More interactive activities",
  "Pre-reading materials would help",
  "Smaller group sizes",
  "More follow-up resources",
  "Better scheduling",
  "More advanced content",
  "Additional case studies",
  "Better technology setup",
  "More regional examples",
  "Clearer objectives upfront",
  "More time for Q&A",
] as const;

const ADDITIONAL_COMMENTS_POOL = [
  "Looking forward to the next session in this series.",
  "Would recommend this program to colleagues.",
  "One of the more valuable trainings we've had this year.",
  "Great organization and structure throughout.",
  "The facilitator created a genuinely open environment for discussion.",
  "Content was well-paced for a mixed-experience audience.",
  "Appreciated the follow-up resources provided after the session.",
  "Venue and logistics were well handled.",
  "Would be useful to have a refresher session in six months.",
  "The group discussions were the most valuable part for me.",
  "Content felt directly relevant to our current priorities.",
  "Good mix of senior and junior participants in the room.",
  "The pace could have been slightly faster in places.",
  "Appreciated the practical tools over abstract theory.",
  "Session ran efficiently and stayed on schedule.",
  "Enjoyed the opportunity to connect with colleagues from other departments.",
  "The facilitator handled questions thoughtfully.",
  "Materials provided were a helpful reference afterward.",
  "A strong addition to our leadership development calendar.",
  "Overall a well-run and worthwhile session.",
] as const;

const nextHighlight = makeRotator(HIGHLIGHTS_POOL);
const nextImprovement = makeRotator(IMPROVEMENTS_POOL);
const nextComment = makeRotator(ADDITIONAL_COMMENTS_POOL);

const WORKSHOP_TITLES = [
  "Leadership Essentials",
  "Strategic Thinking for Executives",
  "Change Management Fundamentals",
  "High Performance Teams",
  "Emotional Intelligence in Leadership",
  "Presentation Skills Advanced",
  "Conflict Resolution and Negotiation",
  "Digital Leadership Transformation",
  "Facilitation Mastery",
  "Executive Presence and Communication",
  "Building High-Trust Teams",
  "Influencing Without Authority",
  "Resilience and Wellbeing at Work",
  "Effective Delegation",
  "Cross-Cultural Leadership",
  "Decision Making Under Pressure",
] as const;

const ASSESSMENT_TITLES = [
  "Hogan Personality Assessment Debrief",
  "360-Degree Leadership Assessment",
  "Talent Potential Assessment",
  "Leadership Competency Assessment",
  "Hogan Development Survey Workshop",
  "Team Effectiveness Assessment",
  "Career Derailers Assessment (HDS)",
  "Values and Motives Assessment (MVPI)",
] as const;

const COACHING_TITLES = [
  "Executive Coaching Intensive",
  "One-on-One Leadership Coaching",
  "Coaching for New Managers",
  "Peer Coaching Circles",
  "Senior Leader Coaching Program",
] as const;

const GOV_WORKSHOP_TITLES = [
  "National Capability Building Program",
  "Public Sector Leadership Excellence",
  "Government Innovation Workshop",
  "Civil Service Leadership Development",
  "National Talent Development Initiative",
] as const;

const RETAIL_WORKSHOP_TITLES = [
  "Retail Leadership Excellence",
  "Customer Experience Leadership",
  "Seasonal Peak Readiness Workshop",
  "Store Operations Leadership",
  "Retail Customer Journey Mastery",
] as const;

const AVIATION_WORKSHOP_TITLES = [
  "Customer Service Excellence in Aviation",
  "Cabin Leadership Program",
  "Service Recovery Mastery",
  "Ground Operations Leadership",
] as const;

const BANKING_WORKSHOP_TITLES = [
  "Digital Banking Leadership",
  "Risk-Aware Leadership",
  "Client Relationship Excellence",
] as const;

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

const COUNTRY_DIAL_CODE: Record<string, string> = {
  "Saudi Arabia": "966",
  UAE: "971",
  Qatar: "974",
};

let emailCounter = 0;

function makeParticipant(country: string, jobTitles: readonly string[], companyName: string) {
  const isArabic = Math.random() < 0.75;
  const isMale = Math.random() < 0.55;

  const firstName = isArabic
    ? pick(isMale ? ARABIC_MALE_FIRST : ARABIC_FEMALE_FIRST)
    : pick(isMale ? WESTERN_MALE_FIRST : WESTERN_FEMALE_FIRST);
  const lastName = isArabic ? pick(ARABIC_LAST) : pick(WESTERN_LAST);

  emailCounter += 1;
  const email = `${slugify(firstName)}.${slugify(lastName)}${emailCounter}@demo.capabilityos.com`;

  const dialCode = COUNTRY_DIAL_CODE[country] ?? "971";
  const mobile = `+${dialCode}5${randomInt(1000000, 9999999)}`;

  return {
    firstName,
    lastName,
    email,
    mobile,
    company: companyName,
    jobTitle: pick(jobTitles),
  };
}

// ---------------------------------------------------------------------------
// Client profiles — one config object per client encodes every pattern from
// the brief; seedClientYear() below is the shared engine that reads it.
// ---------------------------------------------------------------------------

type ExperienceType = "workshop" | "assessment" | "coaching";

type FacilitatorRef = { id: string; name: string; email: string };

type ClientProfile = {
  name: string;
  slugPart: string;
  country: string;
  cities: string[];
  engagementType: "training_contract" | "blended_program";
  typeWeights: { value: ExperienceType; weight: number }[];
  monthWeights: readonly number[];
  jobTitles: readonly string[];
  pickFacilitator: () => FacilitatorRef;
  participantCount: (year: number, type: ExperienceType) => number;
  ratingTarget: (year: number, type: ExperienceType) => number;
  contractValue: (year: number) => number;
  titleFor: (type: ExperienceType) => string;
  durationDays: (type: ExperienceType) => number;
};

// Peaks January-March and September-November, slow in summer and December.
const GENERAL_MONTH_WEIGHTS = [3, 3, 3, 1.5, 1.5, 0.5, 0.3, 0.3, 2.5, 2.5, 2.5, 0.5] as const;
// Majid Al Futtaim: Q4 3-4x Q2, Q1 elevated ahead of retail seasons.
const RETAIL_MONTH_WEIGHTS = [2, 1.5, 1.5, 0.75, 0.75, 0.75, 1, 1, 1.5, 2.75, 2.75, 2.75] as const;

function titlePicker(base: readonly string[], flavor: readonly string[]) {
  const combined = [...base, ...flavor];
  return () => pick(combined);
}

async function buildProfiles(): Promise<Map<string, ClientProfile>> {
  const { data: facilitatorRows, error } = await supabase
    .from("facilitators")
    .select("id, first_name, last_name, email");

  if (error) {
    throw new Error(`Failed to read facilitators: ${error.message}`);
  }

  const byEmail = new Map(
    (facilitatorRows ?? []).map((f) => [
      f.email,
      { id: f.id, name: `${f.first_name} ${f.last_name}`, email: f.email } satisfies FacilitatorRef,
    ])
  );

  function resolve(email: string): FacilitatorRef {
    const ref = byEmail.get(email);
    if (!ref) {
      throw new Error(`Facilitator "${email}" not found — run scripts/seed-facilitators.ts first.`);
    }
    return ref;
  }

  // Saudi Aramco — rotates evenly between 4 facilitators.
  const aramcoPool = [
    resolve("james.anderson@meridianadvisory.com"),
    resolve("yousef.alamin@hoganassessmentsmena.com"),
    resolve("omar.haddad@kenexamena.com"),
    resolve("layla.alsayed@emgfacilitators.com"),
  ];
  const aramcoRotator = makeRotator(aramcoPool);

  // Qatar Airways — rotates between 3 facilitators.
  const qatarPool = [
    resolve("sarah.mitchell@brightpathfacilitation.com"),
    resolve("rami.barakat@catalystcoaching.com"),
    resolve("nour.khoury@catalystcoaching.com"),
  ];
  const qatarRotator = makeRotator(qatarPool);

  // Ministry of Human Resources KSA — one facilitator dominates 60%.
  const mohrWeighted = [
    { value: resolve("khalid.alotaibi@visionleadership.sa"), weight: 60 },
    { value: resolve("layla.alsayed@emgfacilitators.com"), weight: 25 },
    { value: resolve("omar.haddad@kenexamena.com"), weight: 15 },
  ];

  // Emirates NBD — Hogan-heavy, coaching-heavy pool.
  const nbdPool = [
    resolve("omar.haddad@kenexamena.com"),
    resolve("yousef.alamin@hoganassessmentsmena.com"),
    resolve("nour.khoury@catalystcoaching.com"),
  ];
  const nbdRotator = makeRotator(nbdPool);

  // Majid Al Futtaim — retail/design-thinking-leaning pool.
  const mafPool = [
    resolve("huda.mahmoud@designforwardmena.com"),
    resolve("sarah.mitchell@brightpathfacilitation.com"),
    resolve("michael.bennett@meridianadvisory.com"),
  ];
  const mafRotator = makeRotator(mafPool);

  // Each value here is the *input* mean fed to sampleRating(), not the
  // resulting stored average. The 5% "outlier" mechanism (sampleRating's
  // `outlier` branch) necessarily drags the population mean below whatever
  // input mean is used — that's what "5% significantly below average"
  // means by construction — so every value below is pre-compensated by
  // +0.13 (measured empirically: an uncorrected 4.2 input produced a 4.09
  // stored average) so the *actual* overall_rating average lands on the
  // brief's stated numbers.
  const RATING_CORRECTION = 0.13;
  const aramcoRatingByYear: Record<number, number> = { 2020: 4.2, 2021: 4.3, 2022: 4.45, 2023: 4.55, 2024: 4.6 };
  const qatarRatingByYear: Record<number, number> = { 2020: 3.85, 2021: 3.95, 2022: 4.2, 2023: 4.45, 2024: 4.55 };
  const mohrRatingByYear: Record<number, number> = { 2020: 3.7, 2021: 3.8, 2022: 3.9, 2023: 3.8, 2024: 4.0 };
  const mafRatingByYear: Record<number, number> = { 2020: 4.0, 2021: 4.05, 2022: 4.15, 2023: 4.2, 2024: 4.3 };

  for (const map of [aramcoRatingByYear, qatarRatingByYear, mohrRatingByYear, mafRatingByYear]) {
    for (const y of Object.keys(map)) {
      map[Number(y)] += RATING_CORRECTION;
    }
  }

  const profiles = new Map<string, ClientProfile>();

  profiles.set("Saudi Aramco", {
    name: "Saudi Aramco",
    slugPart: "saudi-aramco",
    country: "Saudi Arabia",
    cities: ["Dhahran", "Riyadh", "Jeddah"],
    engagementType: "training_contract",
    typeWeights: [
      { value: "workshop", weight: 70 },
      { value: "assessment", weight: 20 },
      { value: "coaching", weight: 10 },
    ],
    monthWeights: GENERAL_MONTH_WEIGHTS,
    jobTitles: [
      "Senior Manager", "Director", "General Manager", "VP Operations",
      "Chief Engineer", "Department Head", "Senior Engineer", "Regional Director",
    ],
    pickFacilitator: aramcoRotator,
    participantCount: () => randomInt(20, 25),
    ratingTarget: (year) => aramcoRatingByYear[year],
    contractValue: () => randomInt(150_000, 200_000),
    titleFor: (type) =>
      type === "workshop"
        ? titlePicker(WORKSHOP_TITLES, [])()
        : type === "assessment"
          ? pick(ASSESSMENT_TITLES)
          : pick(COACHING_TITLES),
    durationDays: (type) => (type === "workshop" ? 2 : 1),
  });

  profiles.set("Qatar Airways", {
    name: "Qatar Airways",
    slugPart: "qatar-airways",
    country: "Qatar",
    cities: ["Doha"],
    engagementType: "training_contract",
    typeWeights: [
      { value: "workshop", weight: 80 },
      { value: "coaching", weight: 20 },
    ],
    monthWeights: GENERAL_MONTH_WEIGHTS,
    jobTitles: [
      "Customer Service Manager", "Cabin Crew Supervisor", "Station Manager",
      "Service Quality Lead", "Team Leader", "Duty Manager",
    ],
    pickFacilitator: qatarRotator,
    participantCount: (year) => {
      if (year === 2020 || year === 2021) return randomInt(9, 12); // ~50% of normal
      if (year === 2022) return randomInt(18, 24); // recovery to normal
      return randomInt(22, 28); // 2023-2024, above pre-COVID
    },
    ratingTarget: (year) => qatarRatingByYear[year],
    contractValue: (year) => (year === 2020 || year === 2021 ? randomInt(35_000, 45_000) : randomInt(80_000, 120_000)),
    titleFor: (type) =>
      type === "workshop" ? titlePicker(WORKSHOP_TITLES, AVIATION_WORKSHOP_TITLES)() : pick(COACHING_TITLES),
    durationDays: (type) => (type === "workshop" ? 2 : 1),
  });

  profiles.set("Ministry of Human Resources KSA", {
    name: "Ministry of Human Resources KSA",
    slugPart: "mohr-ksa",
    country: "Saudi Arabia",
    cities: ["Riyadh", "Jeddah"],
    engagementType: "training_contract",
    typeWeights: [
      { value: "workshop", weight: 90 },
      { value: "assessment", weight: 10 },
    ],
    monthWeights: GENERAL_MONTH_WEIGHTS,
    jobTitles: [
      "Program Coordinator", "Section Head", "Government Relations Officer",
      "HR Specialist", "Department Director", "Policy Analyst", "Government Employee",
    ],
    pickFacilitator: () => weightedPick(mohrWeighted),
    participantCount: () => randomInt(40, 60),
    ratingTarget: (year) => mohrRatingByYear[year],
    contractValue: () => randomInt(250_000, 350_000),
    titleFor: (type) =>
      type === "workshop" ? titlePicker(WORKSHOP_TITLES, GOV_WORKSHOP_TITLES)() : pick(ASSESSMENT_TITLES),
    durationDays: (type) => (type === "workshop" ? 2 : 1),
  });

  profiles.set("Emirates NBD", {
    name: "Emirates NBD",
    slugPart: "emirates-nbd",
    country: "UAE",
    cities: ["Dubai", "Abu Dhabi"],
    engagementType: "blended_program",
    typeWeights: [
      { value: "workshop", weight: 40 },
      { value: "assessment", weight: 40 },
      { value: "coaching", weight: 20 },
    ],
    monthWeights: GENERAL_MONTH_WEIGHTS,
    jobTitles: [
      "Relationship Manager", "Branch Manager", "Risk Analyst", "Credit Officer",
      "VP Banking Operations", "Senior Relationship Manager",
    ],
    pickFacilitator: nbdRotator,
    participantCount: (_year, type) => (type === "assessment" ? randomInt(8, 12) : randomInt(15, 20)),
    // Same +0.13 outlier compensation as the year-keyed maps above.
    ratingTarget: (_year, type) => (type === "coaching" ? 4.7 : type === "assessment" ? 4.2 : 4.05) + 0.13,
    contractValue: () => randomInt(100_000, 150_000),
    titleFor: (type) =>
      type === "workshop"
        ? titlePicker(WORKSHOP_TITLES, BANKING_WORKSHOP_TITLES)()
        : type === "assessment"
          ? pick(ASSESSMENT_TITLES)
          : pick(COACHING_TITLES),
    durationDays: (type) => (type === "assessment" ? 1 : type === "coaching" ? 1 : 2),
  });

  profiles.set("Majid Al Futtaim", {
    name: "Majid Al Futtaim",
    slugPart: "majid-al-futtaim",
    country: "UAE",
    cities: ["Dubai", "Abu Dhabi"],
    engagementType: "training_contract",
    typeWeights: [
      { value: "workshop", weight: 85 },
      { value: "coaching", weight: 15 },
    ],
    monthWeights: RETAIL_MONTH_WEIGHTS,
    jobTitles: [
      "Store Manager", "Regional Retail Manager", "Customer Experience Lead",
      "Category Manager", "Operations Supervisor", "Area Manager",
    ],
    pickFacilitator: mafRotator,
    participantCount: () => randomInt(25, 35),
    ratingTarget: (year) => mafRatingByYear[year],
    contractValue: () => randomInt(70_000, 100_000),
    titleFor: (type) =>
      type === "workshop" ? titlePicker(WORKSHOP_TITLES, RETAIL_WORKSHOP_TITLES)() : pick(COACHING_TITLES),
    durationDays: (type) => (type === "workshop" ? 2 : 1),
  });

  return profiles;
}

// ---------------------------------------------------------------------------
// Per client-year seeding
// ---------------------------------------------------------------------------

type ExistingState = {
  clientIdByName: Map<string, string>;
  engagementByKey: Map<string, { id: string; hasExperiences: boolean }>;
};

async function loadExistingState(clientNames: string[]): Promise<ExistingState> {
  const { data: clientRows, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .in("name", clientNames);

  if (clientError) {
    throw new Error(`Failed to read clients: ${clientError.message}`);
  }

  const clientIdByName = new Map((clientRows ?? []).map((c) => [c.name, c.id]));

  for (const name of clientNames) {
    if (!clientIdByName.has(name)) {
      throw new Error(
        `Client "${name}" not found. Run scripts/seed-clients-engagements.ts before this script.`
      );
    }
  }

  const clientIds = [...clientIdByName.values()];

  const { data: engagementRows, error: engagementError } = await supabase
    .from("engagements")
    .select("id, title, client_id")
    .in("client_id", clientIds);

  if (engagementError) {
    throw new Error(`Failed to read engagements: ${engagementError.message}`);
  }

  const { data: experienceRows, error: experienceError } = await supabase
    .from("experiences")
    .select("engagement_id")
    .like("slug", "demo-hist-%");

  if (experienceError) {
    throw new Error(`Failed to read existing historical experiences: ${experienceError.message}`);
  }

  const engagementIdsWithExperiences = new Set((experienceRows ?? []).map((r) => r.engagement_id));

  const engagementByKey = new Map<string, { id: string; hasExperiences: boolean }>();
  for (const row of engagementRows ?? []) {
    engagementByKey.set(`${row.client_id}::${row.title}`, {
      id: row.id,
      hasExperiences: engagementIdsWithExperiences.has(row.id),
    });
  }

  return { clientIdByName, engagementByKey };
}

type SeedTotals = { experiences: number; participants: number; surveyResponses: number };

async function seedClientYear(
  workspaceId: string,
  profile: ClientProfile,
  clientId: string,
  year: number,
  state: ExistingState
): Promise<SeedTotals> {
  const engagementTitle = `${profile.name} ${year} Training Program`;
  const key = `${clientId}::${engagementTitle}`;
  const existing = state.engagementByKey.get(key);

  if (existing?.hasExperiences) {
    console.log(`  - ${profile.name} ${year} already seeded, skipping`);
    return { experiences: 0, participants: 0, surveyResponses: 0 };
  }

  let engagementId = existing?.id ?? null;

  if (!engagementId) {
    const { data: inserted, error } = await supabase
      .from("engagements")
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        title: engagementTitle,
        type: profile.engagementType,
        status: "completed",
        start_date: dateOnly(year, 0, 1),
        end_date: dateOnly(year, 11, 31),
        contract_value: profile.contractValue(year),
        currency: "USD",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to insert engagement "${engagementTitle}": ${error?.message}`);
    }

    // `inserted.id` comes back untyped (`any`) since this client isn't
    // parameterized with generated Database types — assigning it straight
    // to `engagementId` would reset that variable's narrowed type back to
    // `string | null`, so it's bound through an explicitly-typed const first.
    const insertedId: string = inserted.id;
    engagementId = insertedId;
  }

  const experienceCount = randomInt(10, 14);

  type ExperienceRow = {
    id: string;
    title: string;
    slug: string;
    description: string;
    venue: string;
    city: string;
    country: string;
    start_date: string;
    end_date: string;
    capacity: number;
    status: "completed";
    experience_type: ExperienceType;
    engagement_id: string;
    client_id: string;
    facilitator_name: string;
    facilitator_email: string;
  };

  const experienceRows: ExperienceRow[] = [];
  const experienceMeta: { id: string; slug: string; type: ExperienceType; participantCount: number }[] = [];

  for (let i = 0; i < experienceCount; i++) {
    const type = weightedPick(profile.typeWeights);
    const month = weightedIndex(profile.monthWeights);
    const day = randomInt(1, 26);
    const duration = profile.durationDays(type);
    const startDate = dateOnly(year, month, day);
    const endDay = Math.min(day + duration - 1, 28);
    const endDate = dateOnly(year, month, endDay);

    const city = pick(profile.cities);
    const facilitator = profile.pickFacilitator();
    const participantCount = profile.participantCount(year, type);
    const id = randomUUID();
    const slug = `demo-hist-${profile.slugPart}-${year}-${pad2(i + 1)}`;
    const title = profile.titleFor(type);

    experienceRows.push({
      id,
      title,
      slug,
      description: `${title} — an Enable My Growth ${type} engagement for ${profile.name}.`,
      venue: `${city}, ${profile.country}`,
      city,
      country: profile.country,
      start_date: `${startDate}T09:00:00+00:00`,
      end_date: `${endDate}T17:00:00+00:00`,
      capacity: participantCount,
      status: "completed",
      experience_type: type,
      engagement_id: engagementId,
      client_id: clientId,
      facilitator_name: facilitator.name,
      facilitator_email: facilitator.email,
    });

    experienceMeta.push({ id, slug, type, participantCount });
  }

  await insertChunked("experiences", experienceRows);

  // Participants — company is the client itself; these are the client's own
  // staff attending HNI-delivered programs.
  type ParticipantRow = {
    id: string;
    workshop_slug: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    company: string;
    job_title: string;
    checked_in: boolean;
    checked_in_at: string;
    source: "QR";
  };

  const participantRows: ParticipantRow[] = [];
  const participantsByExperienceId = new Map<string, ParticipantRow[]>();

  for (let idx = 0; idx < experienceRows.length; idx++) {
    const exp = experienceRows[idx];
    const meta = experienceMeta[idx];
    const bucket: ParticipantRow[] = [];

    for (let p = 0; p < meta.participantCount; p++) {
      const person = makeParticipant(profile.country, profile.jobTitles, profile.name);
      const row: ParticipantRow = {
        id: randomUUID(),
        workshop_slug: exp.slug,
        first_name: person.firstName,
        last_name: person.lastName,
        email: person.email,
        mobile: person.mobile,
        company: person.company,
        job_title: person.jobTitle,
        checked_in: true,
        checked_in_at: new Date(new Date(exp.start_date).getTime() + randomInt(0, 60) * 60_000).toISOString(),
        source: "QR",
      };
      bucket.push(row);
      participantRows.push(row);
    }

    participantsByExperienceId.set(exp.id, bucket);
  }

  await insertChunked("participants", participantRows);

  // Survey tokens — every participant gets one; 70-85% are completed, which
  // is also what drives whether a survey_response row exists for them.
  type TokenRow = {
    id: string;
    participant_id: string;
    workshop_id: string;
    sent_at: string;
    opened_at: string | null;
    completed_at: string | null;
    survey_type: "satisfaction";
  };

  const tokenRows: TokenRow[] = [];
  const completedTokensByExperienceId = new Map<string, { tokenId: string; participantId: string }[]>();

  for (let idx = 0; idx < experienceRows.length; idx++) {
    const exp = experienceRows[idx];
    const participants = participantsByExperienceId.get(exp.id) ?? [];
    const completionRate = randomInt(70, 85) / 100;
    const completedBucket: { tokenId: string; participantId: string }[] = [];

    for (const participant of participants) {
      const isCompleted = Math.random() < completionRate;
      const isOpened = isCompleted || Math.random() < 0.5;
      const sentAt = new Date(new Date(exp.end_date).getTime() + randomInt(1, 3) * 86_400_000);
      const tokenId = randomUUID();

      tokenRows.push({
        id: tokenId,
        participant_id: participant.id,
        workshop_id: exp.id,
        sent_at: sentAt.toISOString(),
        opened_at: isOpened ? new Date(sentAt.getTime() + randomInt(10, 600) * 60_000).toISOString() : null,
        completed_at: isCompleted ? new Date(sentAt.getTime() + randomInt(20, 900) * 60_000).toISOString() : null,
        survey_type: "satisfaction",
      });

      if (isCompleted) {
        completedBucket.push({ tokenId, participantId: participant.id });
      }
    }

    completedTokensByExperienceId.set(exp.id, completedBucket);
  }

  await insertChunked("survey_tokens", tokenRows);

  // Survey responses — one per completed token, ratings sampled around the
  // client/year/type target with a normal spread and occasional outliers.
  type ResponseRow = {
    id: string;
    token_id: string;
    workshop_id: string;
    participant_id: string;
    content_rating: number;
    facilitator_rating: number;
    logistics_rating: number;
    overall_rating: number;
    highlights: string;
    improvements: string;
    additional_comments: string;
    survey_type: "satisfaction";
  };

  const responseRows: ResponseRow[] = [];

  for (let idx = 0; idx < experienceRows.length; idx++) {
    const exp = experienceRows[idx];
    const meta = experienceMeta[idx];
    const target = profile.ratingTarget(year, meta.type);
    const tokens = completedTokensByExperienceId.get(exp.id) ?? [];

    for (const token of tokens) {
      const outlier = Math.random() < 0.05;

      responseRows.push({
        id: randomUUID(),
        token_id: token.tokenId,
        workshop_id: exp.id,
        participant_id: token.participantId,
        content_rating: sampleRating(target, 0.1, outlier),
        facilitator_rating: sampleRating(target, 0.15, outlier),
        logistics_rating: sampleRating(target, -0.15, outlier),
        overall_rating: sampleRating(target, 0, outlier),
        highlights: nextHighlight(),
        improvements: nextImprovement(),
        additional_comments: nextComment(),
        survey_type: "satisfaction",
      });
    }
  }

  await insertChunked("survey_responses", responseRows);

  console.log(
    `Seeding ${profile.name} ${year}... ${experienceRows.length} experiences, ` +
      `${participantRows.length} participants, ${responseRows.length} survey responses`
  );

  return {
    experiences: experienceRows.length,
    participants: participantRows.length,
    surveyResponses: responseRows.length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function resolveWorkspaceId(): Promise<string> {
  const { data, error } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();

  if (error) {
    throw new Error(`Failed to read workspaces: ${error.message}`);
  }
  if (!data) {
    throw new Error("No workspace found — run migration 0001 (or its seed) before this script.");
  }

  return data.id;
}

async function main() {
  console.log("CapabilityOS historical operations seed");
  console.log("========================================\n");

  const startedAt = Date.now();
  const workspaceId = await resolveWorkspaceId();
  const profiles = await buildProfiles();
  const clientNames = [...profiles.keys()];
  const state = await loadExistingState(clientNames);

  const totals: SeedTotals = { experiences: 0, participants: 0, surveyResponses: 0 };

  for (const name of clientNames) {
    const profile = profiles.get(name)!;
    const clientId = state.clientIdByName.get(name)!;

    console.log(`\n${name}`);
    console.log("-".repeat(name.length));

    for (const year of YEARS) {
      const result = await seedClientYear(workspaceId, profile, clientId, year, state);
      totals.experiences += result.experiences;
      totals.participants += result.participants;
      totals.surveyResponses += result.surveyResponses;
    }
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("\nDone.");
  console.log("Final summary");
  console.log("-------------");
  console.log(`Experiences inserted:     ${totals.experiences}`);
  console.log(`Participants inserted:    ${totals.participants}`);
  console.log(`Survey responses inserted: ${totals.surveyResponses}`);
  console.log(`Elapsed: ${elapsedSeconds}s`);
}

main().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
