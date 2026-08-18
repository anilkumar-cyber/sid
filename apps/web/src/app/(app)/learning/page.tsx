"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Music, Plus, Star, Video } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Course, CourseLevel } from "@/lib/types";

interface LearningContentItem {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  url: string;
  course_id: string | null;
  course_level_id: string | null;
  batch_id: string | null;
  is_favorited: boolean;
}

const CONTENT_TYPES = [
  { value: "practice", label: "Practice" },
  { value: "choreography", label: "Choreography" },
  { value: "music", label: "Music" },
  { value: "notes", label: "Notes" },
];

export default function LearningPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [contentType, setContentType] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = user && ["super_admin", "admin", "trainer"].includes(user.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["learning-content", { contentType }],
    queryFn: async () => (await api.get<LearningContentItem[]>("/learning-content", { params: { content_type: contentType || undefined } })).data,
  });

  const toggleFavorite = useMutation({
    mutationFn: async (id: string) => api.post(`/learning-content/${id}/favorite`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning-content"] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select className="w-48" value={contentType} onChange={(e) => setContentType(e.target.value)}>
          <option value="">All content</option>
          {CONTENT_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {canUpload && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" /> Upload Content
          </Button>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No learning content yet" description="Practice videos, choreography, music, and notes will show up here." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {item.content_type === "music" ? (
                  <Music className="h-4 w-4 text-accent" />
                ) : item.content_type === "notes" ? (
                  <BookOpen className="h-4 w-4 text-info" />
                ) : (
                  <Video className="h-4 w-4 text-primary" />
                )}
                <p className="font-medium text-foreground">{item.title}</p>
              </div>
              <button onClick={() => toggleFavorite.mutate(item.id)} aria-label="Favorite">
                <Star className={`h-4 w-4 ${item.is_favorited ? "fill-gold text-gold" : "text-muted"}`} />
              </button>
            </div>
            {item.description && <p className="mt-1 text-xs text-muted">{item.description}</p>}

            <div className="mt-3">
              {item.content_type === "music" ? (
                <audio src={item.url} controls className="w-full" />
              ) : item.content_type === "notes" ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  View / Download
                </a>
              ) : (
                <video src={item.url} controls className="w-full rounded-lg" />
              )}
            </div>
          </Card>
        ))}
      </div>

      {uploadOpen && <UploadContentModal onClose={() => setUploadOpen(false)} />}
    </div>
  );
}

function UploadContentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("practice");
  const [courseId, setCourseId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: async () => (await api.get<Course[]>("/courses")).data });
  const { data: levels } = useQuery({ queryKey: ["course-levels"], queryFn: async () => (await api.get<CourseLevel[]>("/course-levels")).data });
  const [levelId, setLevelId] = useState("");

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file");
      const form = new FormData();
      form.set("title", title);
      form.set("content_type", contentType);
      if (description) form.set("description", description);
      if (levelId) form.set("course_level_id", levelId);
      form.set("file", file);
      return api.post("/learning-content", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      toast.success("Content uploaded");
      queryClient.invalidateQueries({ queryKey: ["learning-content"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const filteredLevels = levels?.filter((l) => !courseId || l.course_id === courseId) ?? [];
  const canSubmit = title.trim().length > 0 && !!file;

  return (
    <Modal title="Upload Learning Content" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bollywood Basics - Week 1" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={contentType} onChange={(e) => setContentType(e.target.value)}>
              {CONTENT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Course</Label>
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setLevelId("");
              }}
            >
              <option value="">Any</option>
              {courses?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {courseId && (
          <div>
            <Label>Level</Label>
            <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
              <option value="">Any</option>
              {filteredLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label>File</Label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-white"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} loading={upload.isPending} onClick={() => upload.mutate()}>
            Upload
          </Button>
        </div>
      </div>
    </Modal>
  );
}
