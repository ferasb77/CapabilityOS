import Image from "next/image";
import { CheckInForm } from "@/features/participants/components/check-in-form";
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
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-12">
        <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <section className="flex flex-col justify-center">
            <div className="mb-10">
              <EnableMyGrowthLogo className="h-auto w-100 max-w-full" />
            </div>

            <p className="mb-3 uppercase tracking-[0.35em] text-amber-300 text-sm">{eyebrow}</p>

            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              {experience.title}
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">
              Welcome to Enable My Growth.
              <br />
              We&apos;re delighted to have you with us today.
              Please complete your check-in using the form.
            </p>

            <div className="mt-12 space-y-5 text-lg text-slate-300">
              <div className="flex items-center gap-4">
                <span className="text-2xl">📅</span>
                <span>{formatDateRange(experience.startDate, experience.endDate)}</span>
              </div>

              {experience.venue && (
                <div className="flex items-center gap-4">
                  <span className="text-2xl">📍</span>
                  <span>{experience.venue}</span>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-[0_40px_120px_rgba(0,0,0,0.35)] sm:rounded-[32px] sm:p-10">
            <CheckInForm workshopSlug={slug} experienceTypeLabel={eyebrow} />
          </section>
        </div>
      </div>
    </main>
  );
}
