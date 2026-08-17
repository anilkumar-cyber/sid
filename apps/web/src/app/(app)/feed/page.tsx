"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Send, Shield } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Textarea } from "@/components/ui/Input";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { FeedPost } from "@/lib/types";

export default function FeedPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");

  const { data, isLoading, isError } = useQuery({ queryKey: ["feed", "posts"], queryFn: async () => (await api.get<FeedPost[]>("/feed/posts")).data });

  const createPost = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.set("caption", caption);
      form.set("visibility", "academy");
      return api.post("/feed/posts", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      setCaption("");
      queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => api.post(`/feed/posts/${postId}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed", "posts"] }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="p-4">
        <Textarea
          rows={3}
          placeholder={`Share something with the Sid Bollywood community, ${user?.full_name.split(" ")[0]}...`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={!caption.trim()} loading={createPost.isPending} onClick={() => createPost.mutate()}>
            <Send className="h-4 w-4" /> Post
          </Button>
        </div>
      </Card>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No posts yet" description="Be the first to share something!" />}

      {data?.map((post) => (
        <Card key={post.id} className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {post.author_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{post.author_name}</p>
                <p className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</p>
              </div>
            </div>
            {post.is_official && (
              <Badge tone="primary">
                <Shield className="mr-1 h-3 w-3" /> Official
              </Badge>
            )}
          </div>
          {post.caption && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{post.caption}</p>}
          <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm text-muted">
            <button
              onClick={() => toggleLike.mutate(post.id)}
              className={`flex items-center gap-1.5 ${post.liked_by_me ? "text-accent" : "hover:text-foreground"}`}
            >
              <Heart className={`h-4 w-4 ${post.liked_by_me ? "fill-accent" : ""}`} /> {post.like_count}
            </button>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> {post.comment_count}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
