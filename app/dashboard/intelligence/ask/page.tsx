import { buildAssistantContext } from "@/features/intelligence/assistant-context";
import { IntelTabs } from "@/features/intelligence/components/intel-tabs";
import { IntelligenceAssistant } from "@/features/intelligence/components/intelligence-assistant";
import { generateSuggestedQuestions } from "@/features/intelligence/suggested-questions";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function AskIntelligencePage() {
  const session = await getSessionContext();
  const assistantContext = await buildAssistantContext(session.workspaceId);
  const suggestedQuestions = generateSuggestedQuestions(assistantContext);
  const { yearsOfData, totalExperiences, totalParticipants } = assistantContext.organization;

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-w-5xl flex-col space-y-6 md:h-[calc(100dvh-6.5rem)]">
      <div>
        <h1 className="text-3xl font-bold">Ask CapabilityOS</h1>
        <p className="mt-2 text-muted-foreground">
          Explore your operational history through conversation. Every answer is grounded in your organization&apos;s data.
        </p>
      </div>

      <IntelTabs activeTab="ask" />

      <div className="min-h-0 flex-1">
        <IntelligenceAssistant
          workspaceId={session.workspaceId}
          suggestedQuestions={suggestedQuestions}
          yearsOfData={yearsOfData}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Responses are based on {yearsOfData} years of operational data covering {totalExperiences} experiences and {totalParticipants} participants.
      </p>
    </div>
  );
}
