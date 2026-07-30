import Image from "next/image";

import { clientPortalSignOut } from "../actions";

type Props = {
  clientName: string;
  fullName: string;
};

export function ClientPortalHeader({ clientName, fullName }: Props) {
  return (
    <header className="bg-[#0B1018] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Image src="/emg/logo-dark.png" alt="Enable My Growth" width={140} height={35} priority className="h-8 w-auto" />
          <div className="hidden h-8 w-px bg-white/20 sm:block" aria-hidden />
          <div>
            <p className="text-xs tracking-[0.25em] text-amber-300 uppercase">Training Portal</p>
            <p className="font-heading text-lg font-semibold">{clientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate-300">
          <span>Welcome, {fullName}</span>
          <form action={clientPortalSignOut}>
            <button type="submit" className="font-medium text-amber-300 hover:text-amber-200">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
