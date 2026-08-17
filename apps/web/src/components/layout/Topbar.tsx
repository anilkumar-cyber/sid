"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/nav";

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await api.get<{ count: number }>("/notifications/unread-count")).data,
    refetchInterval: 60_000,
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button className="rounded-md p-1.5 text-muted hover:bg-black/[0.05] md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/notifications" className="relative rounded-full p-2 text-muted hover:bg-black/[0.05]" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {!!data?.count && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                {data.count > 9 ? "9+" : data.count}
              </span>
            )}
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-foreground">{user.full_name}</p>
            <p className="text-xs leading-tight text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <button onClick={logout} className="rounded-full p-2 text-muted hover:bg-black/[0.05]" aria-label="Log out" title="Log out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative animate-fade-in" onClick={() => setMobileOpen(false)}>
            <Sidebar role={user.role} />
          </div>
        </div>
      )}
    </>
  );
}
