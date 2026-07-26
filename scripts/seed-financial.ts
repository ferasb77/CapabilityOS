/**
 * Financial demo seed for Sprint 26's payment milestones layer.
 *
 * Run with: npx tsx scripts/seed-financial.ts
 *
 * Prerequisite: migrations/0020_financial_management.sql must already be
 * applied — this script only inserts rows, it does not create tables.
 *
 * Seeds 3 payment milestones (Contract Signing / Mid-Program / Program
 * Completion) for each of the 5 major demo engagements seeded by
 * scripts/seed-clients-engagements.ts, plus one workspace finance contact.
 *
 * "Mid-Program" is specced as linking to "the 5th or 6th experience in the
 * engagement" — none of these five demo engagements actually has that many
 * experiences yet (they range from 1 to 4), so each links to that
 * engagement's most recently *completed* experience instead, which is the
 * only choice that keeps an already-invoiced/collected milestone's story
 * ("triggered because this experience was completed") coherent.
 *
 * Safe to re-run: milestones are matched by (engagement_id, title), the
 * finance contact by (workspace_id, email).
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

type MilestoneStatus = "pending" | "triggered" | "invoiced" | "collected" | "overdue";

type MilestoneSeed = {
  title: string;
  description: string;
  amountPct: number;
  triggerType: "engagement_signing" | "experience_completion" | "engagement_completion";
  triggerExperienceSlug?: string;
  status: MilestoneStatus;
  triggeredAt?: string;
  invoicedAt?: string;
  collectedAt?: string;
  dueDate?: string;
};

type EngagementSeed = {
  clientName: string;
  engagementTitle: string;
  contractValue: number;
  currency: string;
  milestones: MilestoneSeed[];
};

// The five major demo engagements, per the sprint brief. Amounts are 30% /
// 50% / 20% of each engagement's contract_value.
const ENGAGEMENTS: EngagementSeed[] = [
  {
    clientName: "Saudi Aramco",
    engagementTitle: "Leadership Excellence Program 2026",
    contractValue: 180_000,
    currency: "USD",
    milestones: [
      {
        title: "Contract Signing",
        description: "Deposit due on contract signing.",
        amountPct: 0.3,
        triggerType: "engagement_signing",
        status: "collected",
        triggeredAt: "2026-01-10T09:00:00Z",
        invoicedAt: "2026-01-12T09:00:00Z",
        collectedAt: "2026-01-28T09:00:00Z",
        dueDate: "2026-02-11",
      },
      {
        title: "Mid-Program",
        description: "Due on completion of the program's second delivery.",
        amountPct: 0.5,
        triggerType: "experience_completion",
        triggerExperienceSlug: "demo-strategic-thinking-executives-apr26",
        status: "invoiced",
        triggeredAt: "2026-04-29T09:00:00Z",
        invoicedAt: "2026-05-05T09:00:00Z",
        dueDate: "2026-06-04",
      },
      {
        title: "Program Completion",
        description: "Final payment on completion of all program deliveries.",
        amountPct: 0.2,
        triggerType: "engagement_completion",
        status: "pending",
      },
    ],
  },
  {
    clientName: "Qatar Airways",
    engagementTitle: "Customer Service Leadership",
    contractValue: 95_000,
    currency: "USD",
    milestones: [
      {
        title: "Contract Signing",
        description: "Deposit due on contract signing.",
        amountPct: 0.3,
        triggerType: "engagement_signing",
        status: "collected",
        triggeredAt: "2026-03-15T09:00:00Z",
        invoicedAt: "2026-03-17T09:00:00Z",
        collectedAt: "2026-04-01T09:00:00Z",
        dueDate: "2026-04-16",
      },
      {
        title: "Mid-Program",
        description: "Due on completion of the program's first delivery.",
        amountPct: 0.5,
        triggerType: "experience_completion",
        triggerExperienceSlug: "demo-coaching-skills-managers-may26",
        // Deliberately left un-invoiced — this is the attention-flag demo
        // case ("triggered but not invoiced" upcoming-risk on the dashboard).
        status: "triggered",
        triggeredAt: "2026-05-13T09:00:00Z",
      },
      {
        title: "Program Completion",
        description: "Final payment on completion of all program deliveries.",
        amountPct: 0.2,
        triggerType: "engagement_completion",
        status: "pending",
      },
    ],
  },
  {
    clientName: "Emirates NBD",
    engagementTitle: "Digital Banking Leadership",
    contractValue: 120_000,
    currency: "USD",
    milestones: [
      {
        title: "Contract Signing",
        description: "Deposit due on contract signing.",
        amountPct: 0.3,
        triggerType: "engagement_signing",
        status: "collected",
        triggeredAt: "2026-03-25T09:00:00Z",
        invoicedAt: "2026-03-27T09:00:00Z",
        collectedAt: "2026-04-10T09:00:00Z",
        dueDate: "2026-04-26",
      },
      {
        title: "Mid-Program",
        description: "Due on completion of the program's second delivery.",
        amountPct: 0.5,
        triggerType: "experience_completion",
        triggerExperienceSlug: "demo-change-management-fundamentals-jun26",
        status: "invoiced",
        triggeredAt: "2026-06-10T09:00:00Z",
        invoicedAt: "2026-06-15T09:00:00Z",
        dueDate: "2026-07-15",
      },
      {
        title: "Program Completion",
        description: "Final payment on completion of all program deliveries.",
        amountPct: 0.2,
        triggerType: "engagement_completion",
        status: "pending",
      },
    ],
  },
  {
    clientName: "Ministry of Human Resources KSA",
    engagementTitle: "National Leadership Initiative",
    contractValue: 350_000,
    currency: "USD",
    milestones: [
      {
        title: "Contract Signing",
        description: "Deposit due on contract signing.",
        amountPct: 0.3,
        triggerType: "engagement_signing",
        status: "collected",
        triggeredAt: "2026-04-20T09:00:00Z",
        invoicedAt: "2026-04-22T09:00:00Z",
        collectedAt: "2026-05-08T09:00:00Z",
        dueDate: "2026-05-22",
      },
      {
        title: "Mid-Program",
        description: "Due on completion of the program's second delivery.",
        amountPct: 0.5,
        triggerType: "experience_completion",
        triggerExperienceSlug: "demo-presentation-skills-advanced-jul26",
        status: "invoiced",
        triggeredAt: "2026-07-08T09:00:00Z",
        invoicedAt: "2026-07-12T09:00:00Z",
        dueDate: "2026-08-11",
      },
      {
        title: "Program Completion",
        description: "Final payment on completion of all program deliveries.",
        amountPct: 0.2,
        triggerType: "engagement_completion",
        status: "pending",
      },
    ],
  },
  {
    clientName: "Majid Al Futtaim",
    engagementTitle: "Retail Leadership Academy",
    contractValue: 85_000,
    currency: "USD",
    milestones: [
      {
        title: "Contract Signing",
        description: "Deposit due on contract signing.",
        amountPct: 0.3,
        triggerType: "engagement_signing",
        status: "collected",
        triggeredAt: "2026-02-10T09:00:00Z",
        invoicedAt: "2026-02-12T09:00:00Z",
        collectedAt: "2026-02-25T09:00:00Z",
        dueDate: "2026-03-14",
      },
      {
        title: "Mid-Program",
        description: "Due on completion of the program's delivery.",
        amountPct: 0.5,
        triggerType: "experience_completion",
        triggerExperienceSlug: "demo-hogan-debrief-masterclass-apr26",
        status: "collected",
        triggeredAt: "2026-04-15T09:00:00Z",
        invoicedAt: "2026-04-18T09:00:00Z",
        collectedAt: "2026-05-02T09:00:00Z",
        dueDate: "2026-05-18",
      },
      {
        title: "Program Completion",
        description: "Final payment on completion of all program deliveries.",
        amountPct: 0.2,
        triggerType: "engagement_completion",
        status: "collected",
        triggeredAt: "2026-05-03T09:00:00Z",
        invoicedAt: "2026-05-05T09:00:00Z",
        collectedAt: "2026-05-20T09:00:00Z",
        dueDate: "2026-06-04",
      },
    ],
  },
];

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

async function resolveEngagementId(clientName: string, engagementTitle: string): Promise<string> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("name", clientName)
    .maybeSingle();

  if (clientError) {
    throw new Error(`Failed to read client "${clientName}": ${clientError.message}`);
  }
  if (!client) {
    throw new Error(`Client "${clientName}" not found — run scripts/seed-clients-engagements.ts first.`);
  }

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id")
    .eq("client_id", client.id)
    .eq("title", engagementTitle)
    .maybeSingle();

  if (engagementError) {
    throw new Error(`Failed to read engagement "${engagementTitle}": ${engagementError.message}`);
  }
  if (!engagement) {
    throw new Error(`Engagement "${engagementTitle}" for "${clientName}" not found.`);
  }

  return engagement.id;
}

async function resolveExperienceId(slug: string): Promise<string> {
  const { data, error } = await supabase.from("experiences").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    throw new Error(`Failed to read experience "${slug}": ${error.message}`);
  }
  if (!data) {
    throw new Error(`Experience "${slug}" not found — run scripts/seed-demo.ts first?`);
  }

  return data.id;
}

async function seedMilestones(workspaceId: string, engagement: EngagementSeed): Promise<void> {
  const engagementId = await resolveEngagementId(engagement.clientName, engagement.engagementTitle);

  const { data: existing, error: existingError } = await supabase
    .from("payment_milestones")
    .select("id, title")
    .eq("engagement_id", engagementId)
    .is("deleted_at", null);

  if (existingError) {
    throw new Error(`Failed to read existing milestones for "${engagement.engagementTitle}": ${existingError.message}`);
  }

  const existingTitles = new Set((existing ?? []).map((row) => row.title));

  for (const milestone of engagement.milestones) {
    if (existingTitles.has(milestone.title)) {
      console.log(`Milestone "${milestone.title}" already exists for "${engagement.engagementTitle}" — skipping.`);
      continue;
    }

    const triggerExperienceId = milestone.triggerExperienceSlug
      ? await resolveExperienceId(milestone.triggerExperienceSlug)
      : null;

    const { error } = await supabase.from("payment_milestones").insert({
      engagement_id: engagementId,
      workspace_id: workspaceId,
      title: milestone.title,
      description: milestone.description,
      amount: Math.round(engagement.contractValue * milestone.amountPct),
      currency: engagement.currency,
      trigger_type: milestone.triggerType,
      trigger_experience_id: triggerExperienceId,
      status: milestone.status,
      triggered_at: milestone.triggeredAt ?? null,
      invoiced_at: milestone.invoicedAt ?? null,
      collected_at: milestone.collectedAt ?? null,
      due_date: milestone.dueDate ?? null,
      notification_sent_at: milestone.invoicedAt ?? milestone.triggeredAt ?? null,
    });

    if (error) {
      throw new Error(`Failed to insert milestone "${milestone.title}" for "${engagement.engagementTitle}": ${error.message}`);
    }

    console.log(`Inserted milestone "${milestone.title}" (${milestone.status}) for "${engagement.engagementTitle}".`);
  }
}

async function seedFinanceContact(workspaceId: string): Promise<void> {
  const name = "Finance Team";
  const email = "finance@enablemygrowth.com";

  const { data: existing, error: existingError } = await supabase
    .from("finance_contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to read existing finance contacts: ${existingError.message}`);
  }

  if (existing) {
    console.log(`Finance contact "${email}" already exists — skipping.`);
    return;
  }

  const { error } = await supabase.from("finance_contacts").insert({
    workspace_id: workspaceId,
    name,
    email,
    is_primary: true,
  });

  if (error) {
    throw new Error(`Failed to insert finance contact: ${error.message}`);
  }

  console.log(`Inserted finance contact "${name}" <${email}>.`);
}

async function main() {
  const workspaceId = await resolveWorkspaceId();

  console.log("Seeding payment milestones...");
  for (const engagement of ENGAGEMENTS) {
    await seedMilestones(workspaceId, engagement);
  }

  console.log("\nSeeding finance contact...");
  await seedFinanceContact(workspaceId);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
