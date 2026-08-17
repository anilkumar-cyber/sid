"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await api.get<Batch[]>("/batches")).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Batches, capacity, and weekly schedules.</p>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Batch
          </Button>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No batches yet" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((batch) => (
          <Link key={batch.id} href={`/batches/${batch.id}`}>
          <Card className="p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gold/10 p-2 text-gold">
                <ClipboardList className="h-4 w-4" />
              </div>
              <p className="font-semibold text-foreground">{batch.name}</p>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">
                Capacity: {batch.enrolled_count} / {batch.capacity}
              </span>
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
