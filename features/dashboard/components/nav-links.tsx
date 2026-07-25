"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  GraduationCap,
  LayoutDashboard,
  Package,
  Settings,
  SquareUserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NavIconName, NavItem } from "@/config/navigation";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Users,
  SquareUserRound,
  Package,
  Settings,
};

type Props = {
  items: NavItem[];
};

export function NavLinks({ items }: Props) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        const Icon = ICONS[item.icon];

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={isActive}
              render={<Link href={item.href} />}
            >
              <Icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
