"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  DownloadCloud,
  Globe,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Sparkles,
  Tags,
  UploadCloud,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Page, SidEvent, Student } from "@/lib/types";

interface Album {
  id: string;
  name: string;
  event_id: string | null;
  activity_id: string | null;
  media_count: number;
}

interface MediaAsset {
  id: string;
  album_id: string;
  media_type: string;
  url: string;
  thumbnail_url: string | null;
  status: string;
  downloads_enabled: boolean;
  created_at: string;
}

interface UploadJob {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export default function MediaPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MediaPageContent />
    </Suspense>
  );
}

function MediaPageContent() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const eventFilter = searchParams.get("event_id") ?? "";
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string>("");
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canCreateAlbum = user?.role === "super_admin" || user?.role === "admin";
  const canUpload = user && ["super_admin", "admin", "trainer", "photographer"].includes(user.role);
  const canModerate = user?.role === "super_admin" || user?.role === "admin";
  const isStudent = user?.role === "student";

  const albums = useQuery({
    queryKey: ["albums", eventFilter],
    queryFn: async () => (await api.get<Album[]>("/albums", { params: { event_id: eventFilter || undefined } })).data,
  });
  const pending = useQuery({
    queryKey: ["media", "pending"],
    queryFn: async () => (await api.get<MediaAsset[]>("/media/pending")).data,
    enabled: !!canModerate,
  });
  const approved = useQuery({
    queryKey: ["media", "approved"],
    queryFn: async () => (await api.get<MediaAsset[]>("/media", { params: { status: "approved" } })).data,
    enabled: !!canModerate,
  });

  function uploadFiles(files: FileList) {
    const newJobs: UploadJob[] = Array.from(files).map((file) => ({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, progress: 0, status: "uploading" }));
    setJobs((prev) => [...prev, ...newJobs]);
    newJobs.forEach((job) => runUpload(job));
  }

  function runUpload(job: UploadJob) {
    const form = new FormData();
    form.set("file", job.file);
    api
      .post(`/albums/${selectedAlbum}/media`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          const pct = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
          setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, progress: pct } : j)));
        },
      })
      .then(() => {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "done", progress: 100 } : j)));
        queryClient.invalidateQueries({ queryKey: ["albums"] });
      })
      .catch((err) => {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "error", error: apiErrorMessage(err) } : j)));
      });
  }

  function retryJob(job: UploadJob) {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "uploading", progress: 0, error: undefined } : j)));
    runUpload(job);
  }

  const moderate = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" | "publish" }) =>
      api.post(`/media/${id}/${action}`, action === "reject" ? { reason: "Does not meet quality guidelines" } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["media", "approved"] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const toggleDownloads = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => api.post(`/media/${id}/downloads`, { downloads_enabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const autoTag = useMutation({
    mutationFn: async (albumId: string) => (await api.post<{ tags_created: number }>(`/albums/${albumId}/auto-tag-performers`)).data,
    onSuccess: (data) => {
      toast.success(data.tags_created > 0 ? `Tagged ${data.tags_created} student${data.tags_created === 1 ? "" : "s"}` : "Everyone already tagged");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const [tagTarget, setTagTarget] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {eventFilter && (
        <Badge tone="primary" className="flex w-fit items-center gap-1.5">
          Filtered to one event
        </Badge>
      )}

      {isStudent && <StudentGallery />}

      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Photos / Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select className="w-64" value={selectedAlbum} onChange={(e) => setSelectedAlbum(e.target.value)}>
                <option value="">Select an album</option>
                {albums.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={!selectedAlbum}
                onChange={(e) => {
                  if (e.target.files?.length) uploadFiles(e.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-white disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-muted">Select multiple files at once for bulk upload — drag no further needed, just multi-select in the file picker.</p>

            {jobs.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center gap-2 text-xs">
                    <span className="w-40 truncate">{job.file.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className={`h-full rounded-full ${job.status === "error" ? "bg-danger" : job.status === "done" ? "bg-success" : "bg-primary"}`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    {job.status === "error" && (
                      <button onClick={() => retryJob(job)} className="flex items-center gap-1 text-danger hover:underline">
                        <RotateCcw className="h-3 w-3" /> Retry
                      </button>
                    )}
                    {job.status === "done" && <Check className="h-3.5 w-3.5 text-success" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Albums</CardTitle>
          {canCreateAlbum && (
            <Button size="sm" onClick={() => setAlbumModalOpen(true)}>
              <Plus className="h-4 w-4" /> New Album
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {albums.isLoading && <Spinner />}
          {albums.isError && <ErrorState />}
          {albums.data?.length === 0 && <EmptyState title="No albums yet" />}
          {albums.data?.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted">{a.media_count} items</p>
                </div>
              </div>
              {canModerate && (a.event_id || a.activity_id) && (
                <button
                  onClick={() => autoTag.mutate(a.id)}
                  title="Tag all performers linked to this album's event/performance"
                  className="flex items-center gap-1 rounded-full bg-gold/10 px-2 py-1 text-xs font-medium text-gold hover:bg-gold/20"
                >
                  <Sparkles className="h-3 w-3" /> Auto-tag
                </button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {canModerate && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pending.isLoading && <Spinner />}
            {pending.data?.length === 0 && <EmptyState title="Nothing pending review" />}
            {pending.data?.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-xl border border-border">
                {m.media_type === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnail_url ?? m.url} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-black/[0.05] text-xs text-muted">Video</div>
                )}
                <div className="flex items-center justify-between gap-1 p-2">
                  <button
                    onClick={() => moderate.mutate({ id: m.id, action: "reject" })}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-danger hover:bg-danger/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moderate.mutate({ id: m.id, action: "approve" })}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded-full bg-success/10 text-xs font-medium text-success hover:bg-success/20"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canModerate && (
        <Card>
          <CardHeader>
            <CardTitle>Approved — Ready to Publish</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {approved.isLoading && <Spinner />}
            {approved.data?.length === 0 && <EmptyState title="Nothing approved yet" />}
            {approved.data?.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-xl border border-border">
                {m.media_type === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnail_url ?? m.url} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-black/[0.05] text-xs text-muted">Video</div>
                )}
                <div className="flex items-center justify-between gap-1 p-2">
                  <button
                    onClick={() => setTagTarget(m.id)}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded-full bg-primary/10 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <Tags className="h-3.5 w-3.5" /> Tag
                  </button>
                  <button
                    onClick={() => toggleDownloads.mutate({ id: m.id, enabled: !m.downloads_enabled })}
                    title={m.downloads_enabled ? "Downloads allowed — click to disable" : "Downloads disabled — click to enable"}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${m.downloads_enabled ? "text-muted hover:bg-black/[0.05]" : "text-danger hover:bg-danger/10"}`}
                  >
                    <DownloadCloud className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moderate.mutate({ id: m.id, action: "publish" })}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded-full bg-success/10 text-xs font-medium text-success hover:bg-success/20"
                  >
                    <Globe className="h-3.5 w-3.5" /> Publish
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {albumModalOpen && <CreateAlbumModal onClose={() => setAlbumModalOpen(false)} />}
      {tagTarget && <TagStudentsModal mediaId={tagTarget} onClose={() => setTagTarget(null)} />}
    </div>
  );
}

function StudentGallery() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"photos" | "videos">("photos");
  const me = useQuery({ queryKey: ["students", "me"], queryFn: async () => (await api.get<Student>("/students/me")).data, enabled: !!user });
  const media = useQuery({
    queryKey: ["students", me.data?.id, "media"],
    queryFn: async () => (await api.get<MediaAsset[]>(`/students/${me.data!.id}/media`)).data,
    enabled: !!me.data,
  });
  const filtered = media.data?.filter((m) => m.media_type === (tab === "photos" ? "photo" : "video")) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Gallery</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant={tab === "photos" ? "primary" : "outline"} onClick={() => setTab("photos")}>
            <ImageIcon className="h-3.5 w-3.5" /> Photos
          </Button>
          <Button size="sm" variant={tab === "videos" ? "primary" : "outline"} onClick={() => setTab("videos")}>
            <VideoIcon className="h-3.5 w-3.5" /> Videos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {media.isLoading && <Spinner />}
        {media.data && filtered.length === 0 && <EmptyState title={`No ${tab} yet`} description="Photos and videos you're tagged in will appear here once published." icon={tab === "photos" ? ImageIcon : VideoIcon} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {filtered.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-lg border border-border">
              {tab === "photos" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnail_url ?? m.url} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <video src={m.url} className="aspect-square w-full object-cover" muted controls />
              )}
              {m.downloads_enabled && (
                <a href={m.url} download className="flex items-center justify-center gap-1 border-t border-border py-1.5 text-xs text-muted hover:text-primary">
                  <Download className="h-3 w-3" /> Download
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const schema = z.object({ name: z.string().min(2, "Name is required"), event_id: z.string().optional() });
type FormValues = z.infer<typeof schema>;

function CreateAlbumModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: events } = useQuery({ queryKey: ["events"], queryFn: async () => (await api.get<SidEvent[]>("/events")).data });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/albums", { ...values, event_id: values.event_id || undefined }),
    onSuccess: () => {
      toast.success("Album created");
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="New Album" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Album Name</Label>
          <Input {...register("name")} placeholder="Stage Performances" />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label>Linked Event (optional)</Label>
          <Select {...register("event_id")}>
            <option value="">None</option>
            {events?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            <UploadCloud className="h-4 w-4" /> Create Album
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TagStudentsModal({ mediaId, onClose }: { mediaId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const students = useQuery({
    queryKey: ["students", { page_size: 100 }],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 100 } })).data,
  });

  const tag = useMutation({
    mutationFn: async () => api.post(`/media/${mediaId}/tags`, { student_ids: selectedIds }),
    onSuccess: () => {
      toast.success(`Tagged ${selectedIds.length} student${selectedIds.length === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["media"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  const filtered = students.data?.items.filter((s) => s.full_name.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <Modal title="Tag Students" onClose={onClose}>
      <div className="space-y-4">
        <Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]">
              <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 rounded border-border" />
              {s.full_name}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">{selectedIds.length} selected. Tagged students will see this photo in their gallery once published.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={selectedIds.length === 0} loading={tag.isPending} onClick={() => tag.mutate()}>
            Tag {selectedIds.length || ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
