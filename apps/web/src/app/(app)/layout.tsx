"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Spinner } from "@/components/ui/Feedback";
import { useAuth } from "@/lib/auth";
import { NAV_BY_ROLE } from "@/lib/nav";

const EXTRA_TITLES: { prefix: string; label: string }[] = [
  { prefix: "/notifications", label: "Notifications" },
  { prefix: "/feed/moderation", label: "Feed Moderation" },
  { prefix: "/batches/", label: "Batch Detail" },
  { prefix: "/events/", label: "Event Detail" },
  { prefix: "/students/", label: "Student Profile" },
  { prefix: "/profile", label: "My Profile" },
];

function titleFor(pathname: string, role: string | undefined): string {
  if (!role) return "";
  const extra = EXTRA_TITLES.find((e) => pathname.startsWith(e.prefix));
  if (extra) return extra.label;
  const items = NAV_BY_ROLE[role as keyof typeof NAV_BY_ROLE] ?? [];
  const match = items.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match?.label ?? "Sid Bollywood";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading your workspace..." />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar title={titleFor(pathname, user.role)} />
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
