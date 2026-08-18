"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Globe, Image as ImageIcon, Plus, Tags, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  media_count: number;
}

interface MediaAsset {
  id: string;
  album_id: string;
  media_type: string;
  url: string;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
}

export default function MediaPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canCreateAlbum = user?.role === "super_admin" || user?.role === "admin";
  const canUpload = user && ["super_admin", "admin", "trainer", "photographer"].includes(user.role);
  const canModerate = user?.role === "super_admin" || user?.role === "admin";

  const albums = useQuery({ queryKey: ["albums"], queryFn: async () => (await api.get<Album[]>("/albums")).data });
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

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return api.post(`/albums/${selectedAlbum}/media`, form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      toast.success("Uploaded. Pending admin approval.");
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

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

  const [tagTarget, setTagTarget] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Photos / Videos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
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
              disabled={!selectedAlbum}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
              }}
              className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-white disabled:opacity-50"
            />
            {upload.isPending && <Spinner label="Uploading..." />}
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
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">{a.name}</p>
                <p className="text-xs text-muted">{a.media_count} items</p>
              </div>
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
