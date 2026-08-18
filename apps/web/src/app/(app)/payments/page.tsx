"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Branch, Page, Payment, RevenueSummary, Student } from "@/lib/types";

export default function PaymentsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PaymentsPageContent />
    </Suspense>
  );
}

function PaymentsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const summary = useQuery({ queryKey: ["payments", "summary"], queryFn: async () => (await api.get<RevenueSummary>("/payments/summary")).data, enabled: !!canManage });
  const payments = useQuery({
    queryKey: ["payments", "list", status],
    queryFn: async () => (await api.get<Page<Payment>>("/payments", { params: { page_size: 20, status: status || undefined } })).data,
  });

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Today's Revenue" value={`₹${summary.data?.today_revenue.toLocaleString() ?? "—"}`} icon={CreditCard} tone="success" />
          <StatCard label="This Month" value={`₹${summary.data?.month_revenue.toLocaleString() ?? "—"}`} icon={CreditCard} tone="primary" />
          <StatCard label="Pending" value={summary.data?.pending_payments_count ?? "—"} icon={CreditCard} tone="warning" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted">Payment history and receipts.</p>
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto">
        {payments.isLoading && <Spinner />}
        {payments.isError && <ErrorState />}
        {payments.data?.items.length === 0 && <EmptyState title="No payments found" description="Try adjusting your filters." />}
        {!!payments.data?.items.length && (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-black/[0.02] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.data.items.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium text-foreground">{p.invoice_number ?? "—"}</td>
                  <td className="px-4 py-3">₹{p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize text-muted">{p.method}</td>
                  <td className="px-4 py-3 text-muted">{p.payment_date}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {open && <RecordPaymentModal onClose={() => setOpen(false)} />}
    </div>
  );
}

const schema = z.object({
  student_id: z.string().min(1, "Select a student"),
  branch_id: z.string().min(1, "Select a branch"),
  amount: z.coerce.number().min(1, "Enter an amount"),
  method: z.enum(["cash", "upi", "card", "online", "other"]),
  payment_date: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

function RecordPaymentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: students } = useQuery({
    queryKey: ["students", { page_size: 100 }],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 100 } })).data,
  });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: async () => (await api.get<Branch[]>("/branches")).data });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { method: "cash", payment_date: new Date().toISOString().slice(0, 10) },
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/payments", values),
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Record Payment" onClose={onClose}>
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
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" {...register("amount")} />
            <FieldError message={errors.amount?.message} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Method</Label>
            <Select {...register("method")}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label>Payment Date</Label>
            <Input type="date" {...register("payment_date")} />
          </div>
        </div>
        <div>
          <Label>Reference (optional)</Label>
          <Input {...register("reference")} placeholder="Transaction ID" />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} {...register("notes")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
