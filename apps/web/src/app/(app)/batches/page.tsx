"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, ClipboardList, LayoutGrid, Plus, TrendingUp, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Batch, Branch, Course, CourseLevel, Trainer } from "@/lib/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const HEALTH_CONFIG: Record<string, { label: string; tone: "danger" | "warning" | "info" }> = {
  high_demand: { label: "High Demand", tone: "warning" },
  low_utilization: { label: "Low Utilization", tone: "info" },
  trainer_conflict: { label: "Trainer Conflict", tone: "danger" },
  studio_conflict: { label: "Studio Conflict", tone: "danger" },
};

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  course_level_id: z.string().min(1, "Select a level"),
  branch_id: z.string().min(1, "Select a branch"),
  trainer_id: z.string().optional(),
  capacity: z.coerce.number().min(1),
  schedules: z
    .array(z.object({ day_of_week: z.coerce.number().min(0).max(6), start_time: z.string().min(1), end_time: z.string().min(1) }))
    .min(1, "Add at least one weekly slot"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export default function BatchesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BatchesPageContent />
    </Suspense>
  );
}

function BatchesPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"grid" | "schedule">("grid");
  const [branchId, setBranchId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [availability, setAvailability] = useState("");
  const [health, setHealth] = useState(searchParams.get("health") ?? "");
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["batches", { branchId, trainerId, availability, health }],
    queryFn: async () =>
      (
        await api.get<Batch[]>("/batches", {
          params: {
            branch_id: branchId || undefined,
            trainer_id: trainerId || undefined,
            availability: availability || undefined,
            health: health || undefined,
          },
        })
      ).data,
  });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: async () => (await api.get<Branch[]>("/branches")).data });
  const { data: trainers } = useQuery({ queryKey: ["trainers"], queryFn: async () => (await api.get<Trainer[]>("/trainers")).data });

  const scheduleByDay = useMemo(() => {
    const grouped: Batch[][] = Array.from({ length: 7 }, () => []);
    data?.forEach((batch) => {
      batch.schedules.forEach((slot) => {
        if (!grouped[slot.day_of_week].some((b) => b.id === batch.id)) grouped[slot.day_of_week].push(batch);
      });
    });
    return grouped;
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-40" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Select className="w-40" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
            <option value="">All trainers</option>
            {trainers?.map((t) => (
              <option key={t.id} value={t.user_id}>{t.full_name}</option>
            ))}
          </Select>
          <Select className="w-36" value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="">Any availability</option>
            <option value="available">Has seats</option>
            <option value="full">Full</option>
            <option value="waitlist">Has waitlist</option>
          </Select>
          <Select className="w-44" value={health} onChange={(e) => setHealth(e.target.value)}>
            <option value="">Any health</option>
            <option value="high_demand">High demand</option>
            <option value="low_utilization">Low utilization</option>
            <option value="trainer_conflict">Trainer conflict</option>
            <option value="studio_conflict">Studio conflict</option>
          </Select>
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${view === "grid" ? "bg-primary text-white" : "text-muted hover:bg-black/[0.02]"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
            <button
              onClick={() => setView("schedule")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${view === "schedule" ? "bg-primary text-white" : "text-muted hover:bg-black/[0.02]"}`}
            >
              <CalendarRange className="h-3.5 w-3.5" /> Schedule
            </button>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Batch
          </Button>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No batches found" description="Try adjusting your filters." />}

      {view === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((batch) => (
            <Link key={batch.id} href={`/batches/${batch.id}`}>
              <Card className="p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-gold/10 p-2 text-gold">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{batch.name}</p>
                      <p className="text-xs text-muted">{batch.course_name} · {batch.level_name}</p>
                    </div>
                  </div>
                </div>

                {batch.health.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {batch.health.map((h) => {
                      const config = HEALTH_CONFIG[h];
                      if (!config) return null;
                      return (
                        <Badge key={h} tone={config.tone} className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {config.label}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 space-y-1 text-xs text-muted">
                  <p>{batch.trainer_name ?? "Unassigned trainer"} · {batch.studio_name ?? "No studio"} · {batch.branch_name}</p>
                  {batch.schedules.length > 0 && (
                    <p>{batch.schedules.map((s) => `${DAYS[s.day_of_week].slice(0, 3)} ${s.start_time.slice(0, 5)}`).join(", ")}</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted">
                    <Users className="h-3.5 w-3.5" /> {batch.enrolled_count} / {batch.capacity}
                  </span>
                  {batch.attendance_percent != null && (
                    <span className="flex items-center gap-1 text-muted">
                      <TrendingUp className="h-3.5 w-3.5" /> {batch.attendance_percent}%
                    </span>
                  )}
                  {batch.waitlist_count > 0 && <Badge tone="info">{batch.waitlist_count} waitlisted</Badge>}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (batch.enrolled_count / batch.capacity) * 100)}%` }}
                  />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {view === "schedule" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
          {DAYS.map((day, idx) => (
            <div key={day} className="rounded-xl border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted">{day}</p>
              <div className="space-y-2">
                {scheduleByDay[idx].length === 0 && <p className="text-xs text-muted">—</p>}
                {scheduleByDay[idx].map((batch) => {
                  const slot = batch.schedules.find((s) => s.day_of_week === idx);
                  return (
                    <Link key={batch.id} href={`/batches/${batch.id}`} className="block rounded-lg border border-border p-2 text-xs hover:bg-black/[0.02]">
                      <p className="font-medium text-foreground">{batch.name}</p>
                      <p className="text-muted">{slot ? `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}` : ""}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <CreateBatchModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function CreateBatchModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: async () => (await api.get<Branch[]>("/branches")).data });
  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: async () => (await api.get<Course[]>("/courses")).data });
  const { data: levels } = useQuery({
    queryKey: ["course-levels"],
    queryFn: async () => (await api.get<CourseLevel[]>("/course-levels")).data,
  });
  const { data: trainers } = useQuery({ queryKey: ["trainers"], queryFn: async () => (await api.get<Trainer[]>("/trainers")).data });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: { capacity: 25, schedules: [{ day_of_week: 0, start_time: "18:00", end_time: "19:00" }] } });
  const { fields, append, remove } = useFieldArray({ control, name: "schedules" });

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      api.post("/batches", { ...values, trainer_id: values.trainer_id || undefined }),
    onSuccess: () => {
      toast.success("Batch created");
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="New Batch" onClose={onClose} wide>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Batch Name</Label>
          <Input {...register("name")} placeholder="Bollywood Beginners - Evening" />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Course Level</Label>
            <Select {...register("course_level_id")}>
              <option value="">Select level</option>
              {levels?.map((l) => {
                const course = courses?.find((c) => c.id === l.course_id);
                return (
                  <option key={l.id} value={l.id}>
                    {course?.name} — {l.name}
                  </option>
                );
              })}
            </Select>
            <FieldError message={errors.course_level_id?.message} />
          </div>
          <div>
            <Label>Branch</Label>
            <Select {...register("branch_id")}>
              <option value="">Select branch</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <FieldError message={errors.branch_id?.message} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Trainer</Label>
            <Select {...register("trainer_id")}>
              <option value="">Unassigned</option>
              {trainers?.map((t) => (
                <option key={t.id} value={t.user_id}>
                  {t.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Capacity</Label>
            <Input type="number" {...register("capacity")} />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">Weekly Schedule</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ day_of_week: 0, start_time: "18:00", end_time: "19:00" })}
            >
              <Plus className="h-3.5 w-3.5" /> Add Slot
            </Button>
          </div>
          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-2">
                <Select {...register(`schedules.${idx}.day_of_week`)} className="w-36">
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
                <Input type="time" {...register(`schedules.${idx}.start_time`)} />
                <span className="text-muted">to</span>
                <Input type="time" {...register(`schedules.${idx}.end_time`)} />
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(idx)} className="p-1 text-muted hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <FieldError message={errors.schedules?.message as string | undefined} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Create Batch
          </Button>
        </div>
      </form>
    </Modal>
  );
}
