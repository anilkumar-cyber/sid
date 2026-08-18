"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, ExternalLink, Flag, Heart, ImagePlus, Link2, MessageCircle, Send, Share2, Shield, ShieldAlert, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { FeedPost, PostComment } from "@/lib/types";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
const REPORT_REASONS = ["inappropriate", "harassment", "spam", "copyright", "other"];

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
  const [isOfficial, setIsOfficial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canPostOfficial = user?.role === "super_admin" || user?.role === "admin";

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
      form.set("is_official", String(canPostOfficial && isOfficial));
      selected.forEach((s) => form.append("files", s.file));
      return api.post("/feed/posts", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      setCaption("");
      setIsOfficial(false);
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

  const toggleSave = useMutation({
    mutationFn: async (postId: string) => api.post(`/feed/posts/${postId}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed", "posts"] }),
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => api.delete(`/feed/posts/${postId}`),
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const canPost = caption.trim().length > 0 || selected.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {canPostOfficial && (
        <div className="flex justify-end">
          <Link href="/feed/moderation" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <ShieldAlert className="h-4 w-4" /> Moderation
          </Link>
        </div>
      )}
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Photo / Video
            </Button>
            {canPostOfficial && (
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <input type="checkbox" checked={isOfficial} onChange={(e) => setIsOfficial(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Official announcement
              </label>
            )}
          </div>
          <Button size="sm" disabled={!canPost} loading={createPost.isPending} onClick={() => createPost.mutate()}>
            <Send className="h-4 w-4" /> Post
          </Button>
        </div>
      </Card>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No posts yet" description="Be the first to share something!" />}

      {data?.map((post) => {
        const canDelete = post.author_id === user?.id || user?.role === "super_admin" || user?.role === "admin";
        return (
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
              <div className="flex items-center gap-2">
                {post.is_official && (
                  <Badge tone="primary">
                    <Shield className="mr-1 h-3 w-3" /> Official
                  </Badge>
                )}
                {canDelete && (
                  <button
                    onClick={() => confirm("Delete this post?") && deletePost.mutate(post.id)}
                    className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                    aria-label="Delete post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
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
              <CommentsToggle post={post} />
              <button
                onClick={() => toggleSave.mutate(post.id)}
                className={`flex items-center gap-1.5 ${post.saved_by_me ? "text-primary" : "hover:text-foreground"}`}
                title="Save"
              >
                <Bookmark className={`h-4 w-4 ${post.saved_by_me ? "fill-primary" : ""}`} />
              </button>
              <ReportPost postId={post.id} />
              <SharePost post={post} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CommentsToggle({ post }: { post: FeedPost }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");

  const comments = useQuery({
    queryKey: ["feed", "comments", post.id],
    queryFn: async () => (await api.get<PostComment[]>(`/feed/posts/${post.id}/comments`)).data,
    enabled: open,
  });

  const addComment = useMutation({
    mutationFn: async () => api.post(`/feed/posts/${post.id}/comments`, { body }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["feed", "comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="flex-1">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 hover:text-foreground">
        <MessageCircle className="h-4 w-4" /> {post.comment_count}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {comments.isLoading && <Spinner />}
          {comments.data?.length === 0 && <p className="text-xs text-muted">No comments yet.</p>}
          {comments.data?.map((c) => (
            <div key={c.id} className="flex gap-2 text-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {c.author_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p>
                  <span className="font-medium text-foreground">{c.author_name}</span>{" "}
                  <span className="text-foreground">{c.body}</span>
                </p>
                <p className="text-xs text-muted">{new Date(c.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {!post.comments_disabled ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (body.trim()) addComment.mutate();
              }}
              className="flex gap-2"
            >
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment..." className="h-9 text-sm" />
              <Button type="submit" size="sm" disabled={!body.trim()} loading={addComment.isPending}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted">Comments are disabled for this post.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReportPost({ postId }: { postId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);

  const report = useMutation({
    mutationFn: async () => api.post(`/feed/posts/${postId}/report`, { reason }),
    onSuccess: () => {
      toast.success("Reported. Our team will review it.");
      setOpen(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="ml-auto flex items-center gap-1.5 hover:text-danger" title="Report">
        <Flag className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <Select value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 w-32 text-xs">
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="outline" onClick={() => report.mutate()} loading={report.isPending}>
        Report
      </Button>
      <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SharePost({ post }: { post: FeedPost }) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - 208) });
    setMenuOpen(true);
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}/feed`;
    const shareText = post.caption?.trim() || "Check out this post from Sid Bollywood!";
    const firstImage = post.media.find((m) => m.media_type === "photo");

    if (typeof navigator.share === "function") {
      try {
        if (firstImage && typeof navigator.canShare === "function") {
          const resp = await fetch(firstImage.url);
          const blob = await resp.blob();
          const file = new File([blob], "sid-bollywood-post.jpg", { type: blob.type || "image/jpeg" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: shareText, title: "Sid Bollywood" });
            return;
          }
        }
        await navigator.share({ title: "Sid Bollywood", text: shareText, url: shareUrl });
        return;
      } catch {
        // user cancelled the native share sheet, or it failed — fall through to the menu
      }
    }
    if (menuOpen) {
      setMenuOpen(false);
    } else {
      openMenu();
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/feed`);
    toast.success("Link copied");
    setMenuOpen(false);
  }

  function openExternal(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }

  const shareText = encodeURIComponent(post.caption?.trim() || "Check out this post from Sid Bollywood!");
  const shareUrl = encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/feed`);

  return (
    <div>
      <button ref={buttonRef} onClick={handleShare} className="flex items-center gap-1.5 hover:text-foreground">
        <Share2 className="h-4 w-4" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-50 w-52 space-y-1 rounded-xl border border-border bg-surface p-2 shadow-lg"
          >
            <button onClick={copyLink} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-black/[0.04]">
              <Link2 className="h-4 w-4 text-muted" /> Copy link
            </button>
            <button
              onClick={() => openExternal(`https://wa.me/?text=${shareText}%20${shareUrl}`)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-black/[0.04]"
            >
              <MessageCircle className="h-4 w-4 text-success" /> WhatsApp
            </button>
            <button
              onClick={() => openExternal(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-black/[0.04]"
            >
              <ExternalLink className="h-4 w-4 text-info" /> X (Twitter)
            </button>
            <button
              onClick={() => openExternal(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-black/[0.04]"
            >
              <ExternalLink className="h-4 w-4 text-primary" /> Facebook
            </button>
            <p className="px-3 pt-1 text-[11px] leading-snug text-muted">
              For Instagram, save the photo and share it from the Instagram app — Instagram doesn&apos;t support direct web sharing.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
