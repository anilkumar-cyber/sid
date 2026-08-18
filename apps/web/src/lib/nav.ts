import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileClock,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  PlayCircle,
  Ticket,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";

import type { Role } from "./types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const DASHBOARD: NavItem = { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard };
const LEARNING: NavItem = { label: "Learning", href: "/learning", icon: PlayCircle };
const FEED: NavItem = { label: "Feed", href: "/feed", icon: Megaphone };

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  super_admin: [
    DASHBOARD,
    { label: "Branches", href: "/branches", icon: Building2 },
    { label: "Students", href: "/students", icon: Users },
    { label: "Trainers", href: "/trainers", icon: GraduationCap },
    { label: "Batches", href: "/batches", icon: ClipboardList },
    { label: "Classes", href: "/classes", icon: CalendarDays },
    { label: "Memberships", href: "/memberships", icon: Wallet },
    { label: "Payments", href: "/payments", icon: CreditCard },
    { label: "Events", href: "/events", icon: Ticket },
    { label: "Media", href: "/media", icon: ImageIcon },
    LEARNING,
    FEED,
    { label: "Reports", href: "/reports", icon: TrendingUp },
    { label: "Audit Logs", href: "/audit-logs", icon: FileClock },
  ],
  admin: [
    DASHBOARD,
    { label: "Students", href: "/students", icon: Users },
    { label: "Trainers", href: "/trainers", icon: GraduationCap },
    { label: "Batches", href: "/batches", icon: ClipboardList },
    { label: "Classes", href: "/classes", icon: CalendarDays },
    { label: "Memberships", href: "/memberships", icon: Wallet },
    { label: "Payments", href: "/payments", icon: CreditCard },
    { label: "Events", href: "/events", icon: Ticket },
    { label: "Media", href: "/media", icon: ImageIcon },
    LEARNING,
    FEED,
    { label: "Reports", href: "/reports", icon: TrendingUp },
    { label: "Audit Logs", href: "/audit-logs", icon: FileClock },
  ],
  receptionist: [
    DASHBOARD,
    { label: "Students", href: "/students", icon: Users },
    { label: "Batches", href: "/batches", icon: ClipboardList },
    { label: "Classes", href: "/classes", icon: CalendarDays },
    { label: "Memberships", href: "/memberships", icon: Wallet },
    { label: "Payments", href: "/payments", icon: CreditCard },
    { label: "Events", href: "/events", icon: Ticket },
    FEED,
  ],
  trainer: [
    DASHBOARD,
    { label: "My Classes", href: "/classes", icon: CalendarDays },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck },
    { label: "My Students", href: "/students", icon: Users },
    { label: "Events", href: "/events", icon: Ticket },
    LEARNING,
    FEED,
  ],
  student: [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Classes", href: "/classes", icon: CalendarDays },
    LEARNING,
    { label: "Events", href: "/events", icon: Ticket },
    FEED,
    { label: "Profile", href: "/profile", icon: User },
  ],
  photographer: [
    DASHBOARD,
    { label: "My Events", href: "/events", icon: Ticket },
    { label: "Albums", href: "/media", icon: ImageIcon },
    FEED,
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  receptionist: "Receptionist",
  trainer: "Trainer",
  student: "Student",
  photographer: "Photographer",
};
