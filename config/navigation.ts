export type NavIconName =
  | "LayoutDashboard"
  | "Building2"
  | "GraduationCap"
  | "Users"
  | "SquareUserRound"
  | "Package"
  | "Settings";

export type NavItem = {
  title: string;
  href: string;
  icon: NavIconName;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { title: "Clients", href: "/dashboard/clients", icon: "Building2" },
  { title: "Experiences", href: "/dashboard/experiences", icon: "GraduationCap" },
  { title: "Participants", href: "/dashboard/participants", icon: "Users" },
  { title: "Facilitators", href: "/dashboard/facilitators", icon: "SquareUserRound" },
  { title: "Assets", href: "/dashboard/assets", icon: "Package" },
  { title: "Settings", href: "/dashboard/settings", icon: "Settings" },
];
