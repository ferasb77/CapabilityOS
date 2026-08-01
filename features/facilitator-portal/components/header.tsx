"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, User, Clock, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import type { FacilitatorPortalSessionContext } from "../data";

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

type Props = {
  facilitator: FacilitatorPortalSessionContext;
};

export function FacilitatorPortalHeader({ facilitator }: Props) {
  const pathname = usePathname();

  const navItems = [
    { href: "/facilitator-portal/programs", label: "My Programs", icon: Calendar },
    { href: "/facilitator-portal/profile", label: "My Profile", icon: User },
    { href: "/facilitator-portal/availability", label: "My Availability", icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-night/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/facilitator-portal" className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-ivory">EMG</span>
            <span className="rounded bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold">
              Facilitator Portal
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-surface-elevated text-gold"
                      : "text-muted-foreground hover:bg-surface-elevated/50 hover:text-ivory"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              {facilitator.photoUrl && <AvatarImage src={facilitator.photoUrl} alt={facilitator.fullName} />}
              <AvatarFallback className="text-xs font-bold">
                {initials(facilitator.firstName, facilitator.lastName)}
              </AvatarFallback>
            </Avatar>

            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold leading-none text-ivory">{facilitator.fullName}</p>
              {facilitator.title && (
                <p className="mt-0.5 text-xs text-muted-foreground">{facilitator.title}</p>
              )}
            </div>
          </div>

          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-destructive">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Mobile Nav bar */}
      <div className="flex md:hidden border-t border-border-subtle bg-surface-elevated/50 px-2 py-1.5 justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                isActive ? "text-gold" : "text-muted-foreground hover:text-ivory"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
