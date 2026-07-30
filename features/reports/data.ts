import { createClient } from "@/infrastructure/supabase/server";
import { getSurveyManagementData } from "@/features/surveys/data";

// ---------------------------------------------------------------------------
// Report branding
// ---------------------------------------------------------------------------

export type ReportBranding = {
  workspaceId: string;
  organizationName: string;
  organizationTagline: string | null;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string | null;
  website: string | null;
  contactEmail: string | null;
};

const DEFAULT_BRANDING: Omit<ReportBranding, "workspaceId"> = {
  organizationName: "Enable My Growth",
  organizationTagline: null,
  logoPath: null,
  primaryColor: "#26215C",
  secondaryColor: "#C9A96E",
  accentColor: "#EDEAE3",
  footerText: null,
  website: null,
  contactEmail: null,
};

type ReportBrandingRow = {
  organization_name: string;
  organization_tagline: string | null;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  footer_text: string | null;
  website: string | null;
  contact_email: string | null;
};

const REPORT_BRANDING_SELECT =
  "organization_name, organization_tagline, logo_path, primary_color, secondary_color, accent_color, footer_text, website, contact_email";

export async function getReportBranding(workspaceId: string): Promise<ReportBranding> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("report_branding")
    .select(REPORT_BRANDING_SELECT)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { workspaceId, ...DEFAULT_BRANDING };
  }

  const row = data as ReportBrandingRow;

  return {
    workspaceId,
    organizationName: row.organization_name,
    organizationTagline: row.organization_tagline,
    logoPath: row.logo_path,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    footerText: row.footer_text,
    website: row.website,
    contactEmail: row.contact_email,
  };
}

// ---------------------------------------------------------------------------
// Satisfaction report data — everything report.ts needs to draw pages 1-5,
// aggregated once here so the PDF generator itself never touches the
// database (mirrors features/certificates/pdf.ts, which is pure too).
// ---------------------------------------------------------------------------

export type ReportDimensionKey = "content" | "facilitator" | "logistics" | "overall";

export type ReportDimensionStats = {
  key: ReportDimensionKey;
  label: string;
  average: number | null;
  /** Index 0 = count of 1-star responses ... index 4 = count of 5-star responses. */
  distribution: number[];
};

export type SatisfactionReportData = {
  experienceTitle: string;
  clientName: string | null;
  venue: string | null;
  startDate: string;
  endDate: string;
  totalParticipants: number;
  surveysSent: number;
  surveysCompleted: number;
  responseRate: number;
  dimensions: ReportDimensionStats[];
  narrative: string;
  feedback: {
    valuable: string[];
    improvements: string[];
    additionalComments: string[];
  };
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

const DIMENSION_DEFS: {
  key: ReportDimensionKey;
  label: string;
  pick: (rating: { contentRating: number | null; facilitatorRating: number | null; logisticsRating: number | null; overallRating: number | null }) => number | null;
}[] = [
  { key: "content", label: "Content Quality", pick: (r) => r.contentRating },
  { key: "facilitator", label: "Facilitator Delivery", pick: (r) => r.facilitatorRating },
  { key: "logistics", label: "Logistics & Organisation", pick: (r) => r.logisticsRating },
  { key: "overall", label: "Overall Experience", pick: (r) => r.overallRating },
];

/**
 * Deterministic narrative — no AI involved, per the sprint brief. "Highest"
 * and "lowest" are drawn only from the three input dimensions (content,
 * facilitator, logistics), never from overall itself, since overall is the
 * aggregate the other three roll up into.
 */
function buildNarrative(dimensions: ReportDimensionStats[]): string {
  const overall = dimensions.find((d) => d.key === "overall")?.average ?? null;

  if (overall === null) {
    return "Not enough survey responses were received to generate a summary for this program.";
  }

  const comparable = dimensions
    .filter((d) => d.key !== "overall" && d.average !== null)
    .sort((a, b) => (b.average as number) - (a.average as number));
  const highest = comparable[0];
  const lowest = comparable[comparable.length - 1];
  const overallText = overall.toFixed(1);

  if (overall >= 4.5) {
    return `Participants rated this program highly across all dimensions, with particularly strong scores in ${highest?.label ?? "all areas"}. The program achieved an overall satisfaction rating of ${overallText} out of 5.`;
  }

  if (overall >= 3.5) {
    return `Participants responded positively to this program overall, rating it ${overallText} out of 5. ${highest?.label ?? "The program"} received the strongest ratings, while ${lowest?.label ?? "other areas"} presents an opportunity for improvement.`;
  }

  return `This program received below-average satisfaction ratings of ${overallText} out of 5. ${lowest?.label ?? "Several dimensions"} scored significantly below expectations and warrants immediate attention.`;
}

/**
 * Caps each open-text section at 10 responses. Below that cap, every
 * response the participant wrote is kept as-is. Above it, single-word
 * throwaway answers ("Good.", "N/A") are dropped first and the remaining
 * responses are ranked by length, on the theory that the longest answers
 * are the most substantive ones worth printing in a client-facing report.
 */
function selectFeedback(texts: (string | null)[]): string[] {
  const nonEmpty = texts.map((text) => text?.trim()).filter((text): text is string => Boolean(text));

  if (nonEmpty.length <= 10) {
    return nonEmpty;
  }

  const substantive = nonEmpty.filter((text) => text.split(/\s+/).length > 1);
  const pool = substantive.length > 0 ? substantive : nonEmpty;

  return [...pool].sort((a, b) => b.length - a.length).slice(0, 10);
}

type ExperienceContextRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  venue: string | null;
  client_name: string | null;
  clients: { name: string } | null;
};

export async function getSatisfactionReportData(experienceId: string): Promise<SatisfactionReportData | null> {
  const supabase = await createClient();

  const [{ data: experienceRow, error: experienceError }, managementData] = await Promise.all([
    supabase
      .from("experiences")
      .select("id, title, start_date, end_date, venue, client_name, clients(name)")
      .eq("id", experienceId)
      .is("deleted_at", null)
      .maybeSingle(),
    getSurveyManagementData(experienceId),
  ]);

  if (experienceError) {
    throw new Error(experienceError.message);
  }

  if (!experienceRow || !managementData) {
    return null;
  }

  const experience = experienceRow as unknown as ExperienceContextRow;
  const responses = managementData.rows.map((row) => row.response).filter((r): r is NonNullable<typeof r> => r !== null);

  const dimensions: ReportDimensionStats[] = DIMENSION_DEFS.map((def) => {
    const values = responses.map(def.pick).filter((value): value is number => value !== null);
    const distribution = [1, 2, 3, 4, 5].map((star) => values.filter((value) => value === star).length);

    return { key: def.key, label: def.label, average: average(values), distribution };
  });

  return {
    experienceTitle: experience.title,
    clientName: experience.clients?.name ?? experience.client_name ?? null,
    venue: experience.venue,
    startDate: experience.start_date,
    endDate: experience.end_date,
    totalParticipants: managementData.totalParticipants,
    surveysSent: managementData.surveysSent,
    surveysCompleted: managementData.surveysCompleted,
    responseRate: managementData.responseRate,
    dimensions,
    narrative: buildNarrative(dimensions),
    feedback: {
      valuable: selectFeedback(responses.map((r) => r.highlights)),
      improvements: selectFeedback(responses.map((r) => r.improvements)),
      additionalComments: selectFeedback(responses.map((r) => r.additionalComments)),
    },
  };
}
