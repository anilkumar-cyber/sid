"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, MessageCircleOff, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { api, apiErrorMessage } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { PostReport } from "@/lib/types";

export default function FeedModerationPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const reports = useQuery({
    queryKey: ["feed", "reports", "pending"],
    queryFn: async () => (await api.get<PostReport[]>("/feed/reports", { params: { status: "pending" } })).data,
  });

  const dismiss = useMutation({
    mutationFn: async (reportId: string) => api.post(`/feed/reports/${reportId}/review`, null, { params: { dismiss: true } }),
    onSuccess: () => {
      toast.success("Report dismissed");
      queryClient.invalidateQueries({ queryKey: ["feed", "reports"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const removePost = useMutation({
    mutationFn: async ({ reportId, postId }: { reportId: string; postId: string }) =>
      Promise.all([api.post(`/feed/posts/${postId}/moderate/remove`), api.post(`/feed/reports/${reportId}/review`, null, { params: { dismiss: false } })]),
    onSuccess: () => {
      toast.success("Post removed");
      queryClient.invalidateQueries({ queryKey: ["feed", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const disableComments = useMutation({
    mutationFn: async (postId: string) => api.post(`/feed/posts/${postId}/moderate/disable-comments`),
    onSuccess: () => {
      toast.success("Comments disabled on that post");
      queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/feed" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Feed
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Reported Posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.isLoading && <Spinner />}
          {reports.isError && <ErrorState />}
          {reports.data?.length === 0 && <EmptyState title="No pending reports" description="Nothing needs your attention right now." />}
          {reports.data?.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <Badge tone="warning">{r.reason.replace(/_/g, " ")}</Badge>
              </div>
              {r.details && <p className="mt-2 text-sm text-muted">{r.details}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => dismiss.mutate(r.id)} loading={dismiss.isPending}>
                  <Check className="h-3.5 w-3.5" /> Dismiss
                </Button>
                <Button size="sm" variant="outline" onClick={() => disableComments.mutate(r.post_id)} loading={disableComments.isPending}>
                  <MessageCircleOff className="h-3.5 w-3.5" /> Disable Comments
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => confirm("Remove this post from the feed?") && removePost.mutate({ reportId: r.id, postId: r.post_id })}
                  loading={removePost.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove Post
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
