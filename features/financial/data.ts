import { createClient } from "@/infrastructure/supabase/server";
import type { AttentionItem } from "@/infrastructure/repositories/dashboard";

import type { MilestoneStatus, MilestoneTriggerType, PaymentTerms } from "./schema";

const MS_PER_DAY = 86_400_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(earlier: string, later: string): number {
  return Math.round((new Date(later).getTime() - new Date(earlier).getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Milestones — engagement Financial tab
// ---------------------------------------------------------------------------

export type Milestone = {
  id: string;
  engagementId: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  triggerType: MilestoneTriggerType;
  triggerExperienceId: string | null;
  triggerExperienceTitle: string | null;
  triggerExperienceSlug: string | null;
  triggerDate: string | null;
  status: MilestoneStatus;
  triggeredAt: string | null;
  invoicedAt: string | null;
  collectedAt: string | null;
  dueDate: string | null;
  financeEmail: string | null;
  notificationSentAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type MilestoneRow = {
  id: string;
  engagement_id: string;
  title: string;
  description: string | null;
  amount: number | string;
  currency: string;
  trigger_type: MilestoneTriggerType;
  trigger_experience_id: string | null;
  trigger_date: string | null;
  status: MilestoneStatus;
  triggered_at: string | null;
  invoiced_at: string | null;
  collected_at: string | null;
  due_date: string | null;
  finance_email: string | null;
  notification_sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  experiences: { title: string; slug: string } | null;
};

const MILESTONE_SELECT =
  "id, engagement_id, title, description, amount, currency, trigger_type, trigger_experience_id, trigger_date, status, triggered_at, invoiced_at, collected_at, due_date, finance_email, notification_sent_at, notes, created_at, updated_at, experiences(title, slug)";

function mapMilestoneRow(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    title: row.title,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    triggerType: row.trigger_type,
    triggerExperienceId: row.trigger_experience_id,
    triggerExperienceTitle: row.experiences?.title ?? null,
    triggerExperienceSlug: row.experiences?.slug ?? null,
    triggerDate: row.trigger_date,
    status: row.status,
    triggeredAt: row.triggered_at,
    invoicedAt: row.invoiced_at,
    collectedAt: row.collected_at,
    dueDate: row.due_date,
    financeEmail: row.finance_email,
    notificationSentAt: row.notification_sent_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMilestonesByEngagement(engagementId: string): Promise<Milestone[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_milestones")
    .select(MILESTONE_SELECT)
    .eq("engagement_id", engagementId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as MilestoneRow[]).map(mapMilestoneRow);
}

export async function getMilestoneById(milestoneId: string): Promise<Milestone | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_milestones")
    .select(MILESTONE_SELECT)
    .eq("id", milestoneId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapMilestoneRow(data as unknown as MilestoneRow) : null;
}

export type EngagementFinancialSummary = {
  totalContractValue: number;
  totalMilestoneValue: number;
  currency: string;
  collected: number;
  invoiced: number;
  triggered: number;
  pending: number;
  outstanding: number;
};

export function summarizeMilestones(
  milestones: Milestone[],
  contractValue: number | null,
  currency: string
): EngagementFinancialSummary {
  const sumOf = (status: MilestoneStatus) =>
    milestones.filter((m) => m.status === status).reduce((sum, m) => sum + m.amount, 0);

  const collected = sumOf("collected");
  const invoiced = sumOf("invoiced");
  const triggered = sumOf("triggered");
  const pending = sumOf("pending") + sumOf("overdue");

  return {
    totalContractValue: contractValue ?? milestones.reduce((sum, m) => sum + m.amount, 0),
    totalMilestoneValue: milestones.reduce((sum, m) => sum + m.amount, 0),
    currency,
    collected,
    invoiced,
    triggered,
    pending,
    outstanding: triggered + invoiced,
  };
}

// ---------------------------------------------------------------------------
// Finance contacts
// ---------------------------------------------------------------------------

export type FinanceContact = { id: string; name: string; email: string; isPrimary: boolean };

export async function getFinanceContacts(workspaceId: string): Promise<FinanceContact[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_contacts")
    .select("id, name, email, is_primary")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({ id: row.id, name: row.name, email: row.email, isPrimary: row.is_primary }));
}

export async function getPrimaryFinanceContactEmail(workspaceId: string): Promise<string | null> {
  const contacts = await getFinanceContacts(workspaceId);
  return contacts.find((c) => c.isPrimary)?.email ?? contacts[0]?.email ?? null;
}

export type FinanceSettings = { defaultCurrency: string; defaultPaymentTerms: PaymentTerms };

export async function getFinanceSettings(workspaceId: string): Promise<FinanceSettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .select("default_currency, default_payment_terms")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    defaultCurrency: data?.default_currency ?? "USD",
    defaultPaymentTerms: (data?.default_payment_terms as PaymentTerms) ?? "net_30",
  };
}

// ---------------------------------------------------------------------------
// Dashboard — Financial Pulse
// ---------------------------------------------------------------------------

type PulseMilestoneRow = {
  id: string;
  engagement_id: string;
  title: string;
  amount: number | string;
  currency: string;
  status: MilestoneStatus;
  triggered_at: string | null;
  invoiced_at: string | null;
  collected_at: string | null;
  due_date: string | null;
  trigger_date: string | null;
  trigger_type: MilestoneTriggerType;
  engagements: { title: string; client_id: string; status: string; clients: { name: string } | null } | null;
};

type EngagementValueRow = { id: string; status: string; contract_value: number | string | null; currency: string | null };

async function loadWorkspaceMilestones(workspaceId: string): Promise<PulseMilestoneRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_milestones")
    .select(
      "id, engagement_id, title, amount, currency, status, triggered_at, invoiced_at, collected_at, due_date, trigger_date, trigger_type, engagements(title, client_id, status, clients(name))"
    )
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as PulseMilestoneRow[];
}

export type RecentMilestoneActivity = {
  id: string;
  clientName: string;
  engagementId: string;
  engagementTitle: string;
  milestoneTitle: string;
  amount: number;
  currency: string;
  status: MilestoneStatus;
  date: string;
  engagementUrl: string;
};

export type FinancialPulse = {
  totalActiveContractValue: number;
  collectedThisYear: number;
  invoicedAwaitingPayment: number;
  triggeredNotInvoiced: number;
  /** Every headline total above is summed within this currency only — see
   * the comment on getFinancialPulse for why. */
  primaryCurrency: string;
  /** True when at least one engagement/milestone uses a different currency
   * than primaryCurrency, meaning the headline totals above don't reflect
   * 100% of activity. The UI should surface this rather than silently
   * showing an incomplete number as if it were the whole picture. */
  hasOtherCurrencies: boolean;
  recentActivity: RecentMilestoneActivity[];
};

function engagementUrl(clientId: string, engagementId: string): string {
  return `/dashboard/clients/${clientId}/engagements/${engagementId}?tab=financial`;
}

/**
 * Milestones and engagements each carry their own `currency` (schema
 * supports USD/SAR/AED/QAR/EUR/GBP — see MILESTONE_CURRENCIES). Naively
 * summing `amount`/`contract_value` across rows with different currencies
 * would silently add e.g. SAR to USD as if they were equal, producing a
 * meaningless blended total. Every workspace's data happens to be
 * single-currency today, which is exactly why this bug was invisible —
 * so instead of trusting that to stay true, every total below is scoped to
 * the workspace's default currency, and `hasOtherCurrencies` tells the UI
 * when that scoping means some activity isn't reflected in the number.
 */
export async function getFinancialPulse(workspaceId: string): Promise<FinancialPulse> {
  const supabase = await createClient();
  const currentYear = new Date().getUTCFullYear();

  const [milestones, engagementRows, financeSettings] = await Promise.all([
    loadWorkspaceMilestones(workspaceId),
    supabase
      .from("engagements")
      .select("id, status, contract_value, currency")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as EngagementValueRow[];
      }),
    getFinanceSettings(workspaceId),
  ]);

  const primaryCurrency = financeSettings.defaultCurrency;

  const hasOtherCurrencies =
    engagementRows.some((e) => e.currency && e.currency !== primaryCurrency) ||
    milestones.some((m) => m.currency !== primaryCurrency);

  const totalActiveContractValue = engagementRows
    .filter((e) => e.status === "active" && (e.currency ?? primaryCurrency) === primaryCurrency)
    .reduce((sum, e) => sum + Number(e.contract_value ?? 0), 0);

  const collectedThisYear = milestones
    .filter(
      (m) =>
        m.status === "collected" &&
        m.collected_at &&
        new Date(m.collected_at).getUTCFullYear() === currentYear &&
        m.currency === primaryCurrency
    )
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const invoicedAwaitingPayment = milestones
    .filter((m) => m.status === "invoiced" && m.currency === primaryCurrency)
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const triggeredNotInvoiced = milestones
    .filter((m) => m.status === "triggered" && m.currency === primaryCurrency)
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const recentActivity: RecentMilestoneActivity[] = milestones
    .filter((m) => m.status === "triggered" || m.status === "invoiced")
    .map((m) => ({
      id: m.id,
      clientName: m.engagements?.clients?.name ?? "Unknown client",
      engagementId: m.engagement_id,
      engagementTitle: m.engagements?.title ?? "Unknown engagement",
      milestoneTitle: m.title,
      amount: Number(m.amount),
      currency: m.currency,
      status: m.status,
      date: (m.status === "invoiced" ? m.invoiced_at : m.triggered_at) ?? m.triggered_at ?? "",
      engagementUrl: engagementUrl(m.engagements?.client_id ?? "", m.engagement_id),
    }))
    .filter((row) => row.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return {
    totalActiveContractValue,
    collectedThisYear,
    invoicedAwaitingPayment,
    triggeredNotInvoiced,
    primaryCurrency,
    hasOtherCurrencies,
    recentActivity,
  };
}

// ---------------------------------------------------------------------------
// Dashboard — Attention flags (read-only; the date-based auto-trigger side
// effect itself lives in features/financial/actions.ts, fire-and-forget
// called from the dashboard page — never from here, since this module only
// reads).
// ---------------------------------------------------------------------------

export type FinancialAttentionItems = {
  critical: AttentionItem[];
  upcomingRisk: AttentionItem[];
  followUp: AttentionItem[];
};

const TRIGGERED_NOT_INVOICED_RISK_DAYS = 7;
const DATE_BASED_UPCOMING_WINDOW_DAYS = 7;

export async function getFinancialAttentionItems(workspaceId: string): Promise<FinancialAttentionItems> {
  const milestones = await loadWorkspaceMilestones(workspaceId);
  const today = todayIso();

  const critical: AttentionItem[] = [];
  const upcomingRisk: AttentionItem[] = [];
  const followUp: AttentionItem[] = [];

  for (const m of milestones) {
    const clientId = m.engagements?.client_id ?? "";
    const engagementTitle = m.engagements?.title ?? "Unknown engagement";
    const url = engagementUrl(clientId, m.engagement_id);

    if (m.due_date && m.due_date < today && ["pending", "triggered", "invoiced"].includes(m.status)) {
      critical.push({
        id: `milestone-overdue-${m.id}`,
        severity: "critical",
        headline: "Payment milestone overdue",
        context: `${m.title} — ${engagementTitle} — due ${m.due_date}`,
        actionLabel: "Review milestone →",
        navigationUrl: url,
      });
    }

    if (m.trigger_type === "date_based" && m.status === "pending" && m.trigger_date && m.trigger_date <= today) {
      critical.push({
        id: `milestone-due-today-${m.id}`,
        severity: "critical",
        headline: "Payment milestone trigger date reached",
        context: `${m.title} — ${engagementTitle} — triggering now`,
        actionLabel: "Review milestone →",
        navigationUrl: url,
      });
    }

    if (m.status === "triggered" && m.triggered_at) {
      const daysSinceTrigger = daysBetween(m.triggered_at.slice(0, 10), today);
      if (daysSinceTrigger > TRIGGERED_NOT_INVOICED_RISK_DAYS) {
        upcomingRisk.push({
          id: `milestone-not-invoiced-${m.id}`,
          severity: "upcoming_risk",
          headline: "Invoice not sent",
          context: `${engagementTitle} — triggered ${daysSinceTrigger} days ago, still not invoiced`,
          actionLabel: "Send invoice →",
          navigationUrl: url,
        });
      }
    }

    if (m.trigger_type === "date_based" && m.status === "pending" && m.trigger_date && m.trigger_date > today) {
      const daysUntil = daysBetween(today, m.trigger_date);
      if (daysUntil <= DATE_BASED_UPCOMING_WINDOW_DAYS) {
        followUp.push({
          id: `milestone-upcoming-${m.id}`,
          severity: "follow_up",
          headline: "Upcoming payment milestone",
          context: `${engagementTitle} — ${m.title} — due ${m.trigger_date}`,
          actionLabel: "Review milestone →",
          navigationUrl: url,
        });
      }
    }
  }

  return { critical, upcomingRisk, followUp };
}
