"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { facilitatorPortalSignOut } from "../actions";

type Props = {
  fullName: string;
  photoUrl: string | null;
};

const NAV_ITEMS = [
  { href: "/facilitator-portal/programs", label: "My Programs" },
  { href: "/facilitator-portal/profile", label: "My Profile" },
  { href: "/facilitator-portal/availability", label: "My Availability" },
] as const;

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function FacilitatorPortalHeader({ fullName, photoUrl }: Props) {
  const pathname = usePathname();

  return (
    <header className="bg-[#0B1018] px-4 py-4 text-white sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Image src="/emg/logo-dark.png" alt="Enable My Growth" width={140} height={35} priority className="h-8 w-auto" />
          <div className="hidden h-8 w-px bg-white/20 sm:block" aria-hidden />
          <div>
            <p className="text-xs tracking-[0.25em] text-amber-300 uppercase">Facilitator Portal</p>
          </div>
        </div>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  active ? "bg-white/10 text-amber-300" : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Avatar size="sm">
            {photoUrl && <AvatarImage src={photoUrl} alt={fullName} />}
            <AvatarFallback className="text-xs text-night">{initials(fullName)}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">{fullName}</span>
          <form action={facilitatorPortalSignOut}>
            <button type="submit" className="font-medium text-amber-300 hover:text-amber-200">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
