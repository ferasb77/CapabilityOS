import type { DashboardGreeting } from "@/infrastructure/repositories/dashboard";

const GREETING_LABEL: Record<DashboardGreeting["timeOfDay"], string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
};

export function DashboardGreetingHeader({ greeting }: { greeting: DashboardGreeting }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">
          {GREETING_LABEL[greeting.timeOfDay]}
          {greeting.firstName ? `, ${greeting.firstName}` : ""}
        </h1>
        <p className="mt-2 text-muted-foreground">Here&apos;s what&apos;s happening across your operation.</p>
      </div>
      <p className="text-sm text-muted-foreground">{greeting.dateLabel}</p>
    </div>
  );
}
