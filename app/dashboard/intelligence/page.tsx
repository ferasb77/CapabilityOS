import { Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buildAssistantContext } from "@/features/intelligence/assistant-context";
import { IntelTabs } from "@/features/intelligence/components/intel-tabs";
import { IntelligenceAssistant } from "@/features/intelligence/components/intelligence-assistant";
import { OrgIntelligenceView } from "@/features/intelligence/components/org-intelligence-view";
import { getOperationalEfficiency, getOrganizationIntelligence, getSatisfactionIntelligence } from "@/features/intelligence/data";
import { generateSuggestedQuestions } from "@/features/intelligence/suggested-questions";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function OrganizationIntelligencePage() {
  const session = await getSessionContext();
  const [data, satisfaction, operations, assistantContext] = await Promise.all([
    getOrganizationIntelligence(session.workspaceId),
    getSatisfactionIntelligence(session.workspaceId),
    getOperationalEfficiency(session.workspaceId),
    buildAssistantContext(session.workspaceId),
  ]);

  const suggestedQuestions = generateSuggestedQuestions(assistantContext);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Intelligence</h1>
        <p className="mt-2 text-muted-foreground">
          Patterns and trends across the entire operation — evidence and insight, for you to decide on.
        </p>
      </div>

      <IntelTabs activeTab="overview" />

      <OrgIntelligenceView data={data} satisfaction={satisfaction} operations={operations} />

      <Separator className="my-2" />

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" />
            Ask CapabilityOS
          </CardTitle>
          <CardDescription>Explore your operational history, clients, engagements, experiences, facilitators and outcomes.</CardDescription>
        </CardHeader>
        <CardContent>
          <IntelligenceAssistant
            workspaceId={session.workspaceId}
            suggestedQuestions={suggestedQuestions}
            yearsOfData={assistantContext.organization.yearsOfData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
