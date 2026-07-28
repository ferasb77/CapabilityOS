import Image from "next/image";
import { CheckinPageContent } from "@/features/participants/components/checkin-page-content";
import { getCheckinContextBySlug } from "@/features/experiences/data";
import { EXPERIENCE_TYPE_LABELS } from "@/features/experiences/schema";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };

  if (startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString("en-US", opts);
  }

  return `${startDate.toLocaleDateString("en-US", opts)} – ${endDate.toLocaleDateString("en-US", opts)}`;
}

function EnableMyGrowthLogo({ className }: { className: string }) {
  return (
    <Image
      src="/emg/logo-dark.png"
      alt="Enable My Growth"
      width={600}
      height={150}
      priority
      className={className}
    />
  );
}

export default async function CheckInPage({ params }: Props) {
  const { slug } = await params;
  const experience = await getCheckinContextBySlug(slug);

  if (!experience) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B1018] px-4 text-center text-white">
        <div className="max-w-md">
          <EnableMyGrowthLogo className="mx-auto mb-10 h-auto w-64 max-w-full" />
          <h1 className="text-3xl font-bold">Workshop not found</h1>
          <p className="mt-3 text-lg text-slate-300">
            This check-in link is invalid or has expired. Please contact Enable My Growth if you
            believe this is a mistake.
          </p>
        </div>
      </main>
    );
  }

  const eyebrow = EXPERIENCE_TYPE_LABELS[experience.experienceType];

  return (
    <main className="min-h-screen bg-[#0B1018] text-white">
      <CheckinPageContent
        workshopSlug={slug}
        title={experience.title}
        titleAr={experience.titleAr}
        eyebrow={eyebrow}
        dateRange={formatDateRange(experience.startDate, experience.endDate)}
        venue={experience.venue}
      />
    </main>
  );
}
