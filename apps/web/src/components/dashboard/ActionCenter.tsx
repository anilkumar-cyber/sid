"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import type { ActionCenter as ActionCenterData, ActionItem } from "@/lib/types";

const PRIORITY_CONFIG: Record<
  ActionItem["priority"],
  { tone: "danger" | "warning" | "info" | "neutral"; iconClass: string; icon: typeof AlertCircle; label: string }
> = {
  critical: { tone: "danger", iconClass: "text-danger", icon: AlertCircle, label: "Critical" },
  high: { tone: "warning", iconClass: "text-warning", icon: AlertTriangle, label: "High" },
  medium: { tone: "info", iconClass: "text-info", icon: Info, label: "Medium" },
  informational: { tone: "neutral", iconClass: "text-muted", icon: Info, label: "Info" },
};

export function ActionCenter({ branchId }: { branchId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "action-center", branchId],
    queryFn: async () => (await api.get<ActionCenterData>("/dashboard/action-center", { params: { branch_id: branchId } })).data,
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Center</CardTitle>
        {!!data?.items.length && <Badge tone="neutral">{data.items.length} item{data.items.length !== 1 ? "s" : ""}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Spinner />}
        {!isLoading && data?.items.length === 0 && (
          <EmptyState title="All caught up" description="Nothing needs your attention right now." icon={CheckCircle2} />
        )}
        {data?.items.map((item) => {
          const config = PRIORITY_CONFIG[item.priority];
          const Icon = config.icon;
          return (
            <Link
              key={item.id}
              href={item.link}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-black/[0.02]"
            >
              <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconClass}`} />
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  {item.detail && <p className="text-xs text-muted">{item.detail}</p>}
                </div>
              </div>
              <Badge tone={config.tone}>{config.label}</Badge>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
