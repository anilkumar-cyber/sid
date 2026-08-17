"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ImagePlus, MessageCircle, Send, Shield, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { FeedPost } from "@/lib/types";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];

interface SelectedFile {
  file: File;
  previewUrl: string;
  isVideo: boolean;
}

export default function FeedPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => selected.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, isError } = useQuery({ queryKey: ["feed", "posts"], queryFn: async () => (await api.get<FeedPost[]>("/feed/posts")).data });

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: SelectedFile[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        toast.error(`${file.name}: exceeds ${isVideo ? "500MB" : "20MB"} limit`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file), isVideo });
    }
    setSelected((prev) => [...prev, ...next]);
  }

  function removeSelected(index: number) {
    setSelected((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const createPost = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.set("caption", caption);
      form.set("visibility", "academy");
      selected.forEach((s) => form.append("files", s.file));
      return api.post("/feed/posts", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      setCaption("");
      selected.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => api.post(`/feed/posts/${postId}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed", "posts"] }),
  });

  const canPost = caption.trim().length > 0 || selected.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="p-4">
        <Textarea
          rows={3}
          placeholder={`Share something with the Sid Bollywood community, ${user?.full_name.split(" ")[0]}...`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        {selected.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selected.map((s, i) => (
              <div key={s.previewUrl} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-black/[0.04]">
                {s.isVideo ? (
                  <video src={s.previewUrl} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => removeSelected(i)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="mt-3 flex items-center justify-between">
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> Photo / Video
          </Button>
          <Button size="sm" disabled={!canPost} loading={createPost.isPending} onClick={() => createPost.mutate()}>
            <Send className="h-4 w-4" /> Post
          </Button>
        </div>
      </Card>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No posts yet" description="Be the first to share something!" />}

      {data?.map((post) => (
        <Card key={post.id} className="overflow-hidden p-5">
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

          {post.media.length > 0 && (
            <div
              className={cn(
                "mt-3 -mx-5 grid gap-0.5 overflow-hidden",
                post.media.length === 1 ? "grid-cols-1" : post.media.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
              )}
            >
              {post.media.map((m) => (
                <div key={m.id} className="aspect-square bg-black/[0.04]">
                  {m.media_type === "video" ? (
                    <video src={m.url} controls className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}

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
