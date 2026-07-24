import Image from "next/image";
import { CheckCircle2, FolderOpen } from "lucide-react";

type Props = {
  materialsUrl?: string | null;
};

export function SuccessScreen({ materialsUrl }: Props) {
  return (
    <div className="flex flex-col items-center py-8 text-center animate-in fade-in duration-500">
      <Image
        src="/emg/logo-dark.png"
        alt="Enable My Growth"
        width={600}
        height={150}
        priority
        className="h-auto w-100 max-w-full"
      />

      <CheckCircle2
        className="mb-6 text-green-600"
        size={72}
        strokeWidth={1.75}
      />

      <h2 className="text-4xl font-bold tracking-tight">
        Welcome!
      </h2>

      <p className="mt-6 max-w-sm text-lg leading-8 text-slate-600">
        Your check-in has been completed successfully.
      </p>

      <div className="mt-10 rounded-2xl bg-slate-50 px-8 py-6">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-600">
          Today&apos;s Workshop
        </p>

        <h3 className="mt-3 text-2xl font-semibold">
          AI Powered Design Thinking
        </h3>

        <p className="mt-4 text-slate-600">
          Thank you for joining us.
        </p>
      </div>

      {materialsUrl && (
        <a
          href={materialsUrl}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#C8A24A] px-6 py-3 text-base font-semibold text-[#0B1018] transition-all duration-200 hover:bg-[#D9B765] hover:shadow-lg"
        >
          <FolderOpen size={20} />
          Access Program Materials
        </a>
      )}

      <div className="mt-10 text-sm text-slate-500">
        Enable My Growth
      </div>
    </div>
  );
}