"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/ui/BrandMark";
import { cn } from "@/lib/cn";
import { NAV_BY_ROLE, ROLE_LABEL } from "@/lib/nav";
import type { Role } from "@/lib/types";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 border-b border-border px-5 py-5">
        <BrandMark size="sm" />
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">Sid Bollywood</p>
          <p className="text-xs leading-tight text-muted">{ROLE_LABEL[role]}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted hover:bg-black/[0.04] hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
