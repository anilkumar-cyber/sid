"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => (await api.get<NotificationItem[]>("/notifications")).data,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = data?.filter((n) => !n.is_read).length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</p>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <Card className="divide-y divide-border">
        {isLoading && <Spinner />}
        {isError && <ErrorState />}
        {data?.length === 0 && <EmptyState title="No notifications yet" description="Updates about classes, payments, and events will show up here." />}
        {data?.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.is_read && markRead.mutate(n.id)}
            className={cn("flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-black/[0.02]", !n.is_read && "bg-primary/[0.03]")}
          >
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", !n.is_read ? "bg-primary/10 text-primary" : "bg-black/[0.05] text-muted")}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className={cn("text-sm", !n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground")}>{n.title}</p>
                {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </div>
              {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
              <p className="mt-1 text-xs text-muted">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
          </button>
        ))}
      </Card>
    </div>
  );
}
