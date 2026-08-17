"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRightLeft, Plus, UserX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Batch, Page, Student } from "@/lib/types";

interface Enrollment {
  id: string;
  student_id: string;
  batch_id: string;
  status: string;
  enrolled_date: string;
  waitlist_position: number | null;
}

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Enrollment | null>(null);
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const batch = useQuery({ queryKey: ["batches", id], queryFn: async () => (await api.get<Batch>(`/batches/${id}`)).data });
  const enrollments = useQuery({
    queryKey: ["enrollments", { batch_id: id }],
    queryFn: async () => (await api.get<Enrollment[]>("/enrollments", { params: { batch_id: id } })).data,
  });
  const students = useQuery({
    queryKey: ["students", { page_size: 100 }],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 100 } })).data,
  });
  const studentName = (studentId: string) => students.data?.items.find((s) => s.id === studentId)?.full_name ?? "Student";

  const cancelEnrollment = useMutation({
    mutationFn: async (enrollmentId: string) => api.post(`/enrollments/${enrollmentId}/cancel`),
    onSuccess: () => {
      toast.success("Enrollment cancelled");
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (batch.isLoading) return <Spinner />;
  if (batch.isError || !batch.data) return <ErrorState message="Batch not found." />;

  const active = enrollments.data?.filter((e) => e.status === "active") ?? [];
  const waitlisted = enrollments.data?.filter((e) => e.status === "waitlisted") ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/batches" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Batches
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{batch.data.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Capacity {batch.data.enrolled_count} / {batch.data.capacity}
              {waitlisted.length > 0 && ` · ${waitlisted.length} waitlisted`}
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setEnrollOpen(true)}>
              <Plus className="h-4 w-4" /> Enroll Student
            </Button>
          )}
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, (batch.data.enrolled_count / batch.data.capacity) * 100)}%` }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrolled Students ({active.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {enrollments.isLoading && <Spinner />}
          {active.length === 0 && <EmptyState title="No students enrolled yet" />}
          {active.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{studentName(e.student_id)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Since {e.enrolled_date}</span>
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setTransferTarget(e)}>
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => cancelEnrollment.mutate(e.id)}>
                      <UserX className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waitlist ({waitlisted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {waitlisted.length === 0 && <EmptyState title="No one on the waitlist" />}
          {waitlisted
            .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0))
            .map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
                <span className="font-medium text-foreground">
                  #{e.waitlist_position} · {studentName(e.student_id)}
                </span>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => cancelEnrollment.mutate(e.id)}>
                    <UserX className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      {enrollOpen && <EnrollStudentModal batchId={id} onClose={() => setEnrollOpen(false)} />}
      {transferTarget && <TransferModal enrollment={transferTarget} onClose={() => setTransferTarget(null)} />}
    </div>
  );
}

const enrollSchema = z.object({ student_id: z.string().min(1, "Select a student") });
type EnrollValues = z.infer<typeof enrollSchema>;

function EnrollStudentModal({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: students } = useQuery({
    queryKey: ["students", { page_size: 100 }],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 100 } })).data,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EnrollValues>({ resolver: zodResolver(enrollSchema) });

  const enroll = useMutation({
    mutationFn: async (values: EnrollValues) => api.post("/enrollments", { ...values, batch_id: batchId }),
    onSuccess: () => {
      toast.success("Student enrolled");
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Enroll Student" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => enroll.mutate(v))} className="space-y-4">
        <div>
          <Label>Student</Label>
          <Select {...register("student_id")}>
            <option value="">Select student</option>
            {students?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </Select>
          <FieldError message={errors.student_id?.message} />
        </div>
        <p className="text-xs text-muted">If the batch is at capacity, the student is added to the waitlist automatically.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || enroll.isPending}>
            Enroll
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const transferSchema = z.object({ to_batch_id: z.string().min(1, "Select a batch") });
type TransferValues = z.infer<typeof transferSchema>;

function TransferModal({ enrollment, onClose }: { enrollment: Enrollment; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: batches } = useQuery({ queryKey: ["batches"], queryFn: async () => (await api.get<Batch[]>("/batches")).data });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransferValues>({ resolver: zodResolver(transferSchema) });

  const transfer = useMutation({
    mutationFn: async (values: TransferValues) => api.post(`/enrollments/${enrollment.id}/transfer`, values),
    onSuccess: () => {
      toast.success("Student transferred");
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Transfer Student" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => transfer.mutate(v))} className="space-y-4">
        <div>
          <Label>Target Batch</Label>
          <Select {...register("to_batch_id")}>
            <option value="">Select batch</option>
            {batches?.filter((b) => b.id !== enrollment.batch_id).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <FieldError message={errors.to_batch_id?.message} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || transfer.isPending}>
            Transfer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
