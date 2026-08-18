"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, RotateCcw, Wallet, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Membership, MembershipPlan, Page, Student } from "@/lib/types";

export default function MembershipsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MembershipsPageContent />
    </Suspense>
  );
}

function MembershipsPageContent() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [planOpen, setPlanOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [freezeTarget, setFreezeTarget] = useState<string | null>(null);
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);
  const canManagePlans = user?.role === "super_admin" || user?.role === "admin";

  const plans = useQuery({ queryKey: ["membership-plans"], queryFn: async () => (await api.get<MembershipPlan[]>("/membership-plans")).data });
  const memberships = useQuery({
    queryKey: ["memberships", status],
    queryFn: async () => (await api.get<Membership[]>("/memberships", { params: { status: status || undefined } })).data,
  });
  const students = useQuery({
    queryKey: ["students", { page_size: 100 }],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 100 } })).data,
    enabled: !!canManage,
  });
  const studentName = (id: string) => students.data?.items.find((s) => s.id === id)?.full_name ?? "Student";

  const lifecycle = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "resume" | "renew" | "cancel" }) => api.post(`/memberships/${id}/${action}`),
    onSuccess: () => {
      toast.success("Membership updated");
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Membership Plans</CardTitle>
          {canManagePlans && (
            <Button size="sm" onClick={() => setPlanOpen(true)}>
              <Plus className="h-4 w-4" /> New Plan
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.isLoading && <Spinner />}
          {plans.data?.length === 0 && <EmptyState title="No plans configured yet" />}
          {plans.data?.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-border p-4">
              <p className="font-semibold text-foreground">{plan.name}</p>
              <p className="mt-1 text-lg font-bold text-primary">₹{plan.price.toLocaleString()}</p>
              <p className="text-xs text-muted">
                {plan.duration_days ? `${plan.duration_days} days` : "Credit-based"} ·{" "}
                {plan.class_credits ? `${plan.class_credits} credits` : "Unlimited"}
              </p>
              <p className="mt-1 text-xs capitalize text-muted">{plan.scope.replace(/_/g, " ")}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memberships</CardTitle>
          <div className="flex items-center gap-2">
            <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
              <option value="frozen">Frozen</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            {canManage && (
              <Button size="sm" onClick={() => setMembershipOpen(true)}>
                <Plus className="h-4 w-4" /> Assign Membership
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberships.isLoading && <Spinner />}
          {memberships.isError && <ErrorState />}
          {memberships.data?.length === 0 && <EmptyState title="No memberships yet" />}
          {memberships.data?.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted" />
                <span>
                  {canManage && <span className="font-medium text-foreground">{studentName(m.student_id)} · </span>}
                  {m.start_date} → {m.end_date ?? "No expiry"}
                  {m.remaining_credits != null && <span className="text-muted"> · {m.remaining_credits} credits</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.status} />
                {canManage && m.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => setFreezeTarget(m.id)}>
                    <Pause className="h-3.5 w-3.5" /> Freeze
                  </Button>
                )}
                {canManage && m.status === "frozen" && (
                  <Button size="sm" variant="outline" onClick={() => lifecycle.mutate({ id: m.id, action: "resume" })}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                )}
                {canManage && (m.status === "expired" || m.status === "cancelled") && (
                  <Button size="sm" variant="outline" onClick={() => lifecycle.mutate({ id: m.id, action: "renew" })}>
                    <RotateCcw className="h-3.5 w-3.5" /> Renew
                  </Button>
                )}
                {canManage && (m.status === "active" || m.status === "frozen" || m.status === "expiring") && (
                  <Button size="sm" variant="outline" onClick={() => lifecycle.mutate({ id: m.id, action: "cancel" })}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {planOpen && <CreatePlanModal onClose={() => setPlanOpen(false)} />}
      {membershipOpen && <AssignMembershipModal onClose={() => setMembershipOpen(false)} />}
      {freezeTarget && <FreezeMembershipModal membershipId={freezeTarget} onClose={() => setFreezeTarget(null)} />}
    </div>
  );
}

function FreezeMembershipModal({ membershipId, onClose }: { membershipId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState("");

  const freeze = useMutation({
    mutationFn: async () => api.post(`/memberships/${membershipId}/freeze`, { reason }),
    onSuccess: () => {
      toast.success("Membership frozen");
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Freeze Membership" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Reason</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Student traveling for 3 weeks" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => freeze.mutate()} disabled={!reason.trim()} loading={freeze.isPending}>
            Freeze Membership
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const planSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  duration_days: z.coerce.number().min(1).optional(),
  class_credits: z.coerce.number().min(1).optional(),
  price: z.coerce.number().min(0),
  scope: z.enum(["single_branch", "multi_branch", "all_branches"]).default("single_branch"),
});
type PlanFormInput = z.input<typeof planSchema>;
type PlanFormValues = z.infer<typeof planSchema>;

function CreatePlanModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormInput, unknown, PlanFormValues>({ resolver: zodResolver(planSchema), defaultValues: { scope: "single_branch" } });

  const create = useMutation({
    mutationFn: async (values: PlanFormValues) => api.post("/membership-plans", values),
    onSuccess: () => {
      toast.success("Plan created");
      queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="New Membership Plan" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Plan Name</Label>
          <Input {...register("name")} placeholder="Monthly Unlimited" />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} {...register("description")} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Price (₹)</Label>
            <Input type="number" {...register("price")} />
            <FieldError message={errors.price?.message} />
          </div>
          <div>
            <Label>Duration (days)</Label>
            <Input type="number" {...register("duration_days")} placeholder="30" />
          </div>
          <div>
            <Label>Class Credits</Label>
            <Input type="number" {...register("class_credits")} placeholder="Unlimited" />
          </div>
        </div>
        <div>
          <Label>Scope</Label>
          <Select {...register("scope")}>
            <option value="single_branch">Single Branch</option>
            <option value="multi_branch">Multi Branch</option>
            <option value="all_branches">All Branches</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Create Plan
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const membershipSchema = z.object({
  student_id: z.string().min(1, "Select a student"),
  plan_id: z.string().min(1, "Select a plan"),
  start_date: z.string().min(1, "Select a start date"),
});
type MembershipFormInput = z.input<typeof membershipSchema>;
type MembershipFormValues = z.infer<typeof membershipSchema>;

function AssignMembershipModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: students } = useQuery({
    queryKey: ["students", { page_size: 100 }],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 100 } })).data,
  });
  const { data: plans } = useQuery({ queryKey: ["membership-plans"], queryFn: async () => (await api.get<MembershipPlan[]>("/membership-plans")).data });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MembershipFormInput, unknown, MembershipFormValues>({
    resolver: zodResolver(membershipSchema),
    defaultValues: { start_date: new Date().toISOString().slice(0, 10) },
  });

  const create = useMutation({
    mutationFn: async (values: MembershipFormValues) => api.post("/memberships", { ...values, allowed_branch_ids: [] }),
    onSuccess: () => {
      toast.success("Membership assigned");
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Assign Membership" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
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
        <div>
          <Label>Plan</Label>
          <Select {...register("plan_id")}>
            <option value="">Select plan</option>
            {plans?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — ₹{p.price.toLocaleString()}
              </option>
            ))}
          </Select>
          <FieldError message={errors.plan_id?.message} />
        </div>
        <div>
          <Label>Start Date</Label>
          <Input type="date" {...register("start_date")} />
          <FieldError message={errors.start_date?.message} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}
