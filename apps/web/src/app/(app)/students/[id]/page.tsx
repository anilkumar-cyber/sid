"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { StatusBadge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import type { Membership, Payment, Student, StudentAttendanceStat } from "@/lib/types";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const student = useQuery({
    queryKey: ["students", id],
    queryFn: async () => (await api.get<Student>(`/students/${id}`)).data,
  });
  const stats = useQuery({
    queryKey: ["attendance", "stats", id],
    queryFn: async () => (await api.get<StudentAttendanceStat>(`/attendance/students/${id}/stats`)).data,
  });
  const memberships = useQuery({
    queryKey: ["memberships", { student_id: id }],
    queryFn: async () => (await api.get<Membership[]>("/memberships", { params: { student_id: id } })).data,
  });
  const payments = useQuery({
    queryKey: ["payments", { student_id: id }],
    queryFn: async () => (await api.get<{ items: Payment[] }>("/payments", { params: { student_id: id } })).data.items,
  });

  if (student.isLoading) return <Spinner />;
  if (student.isError || !student.data) return <ErrorState message="Student not found." />;

  const s = student.data;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/students" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{s.full_name}</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {s.email}</span>
              {s.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {s.phone}</span>}
            </div>
          </div>
          <StatusBadge status={s.status} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted">Skill Level</p>
            <p className="font-medium capitalize text-foreground">{s.skill_level ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted">Joined</p>
            <p className="font-medium text-foreground">{s.joining_date}</p>
          </div>
          <div>
            <p className="text-muted">Attendance</p>
            <p className="font-medium text-foreground">{stats.data ? `${stats.data.attendance_percent}%` : "—"}</p>
          </div>
          <div>
            <p className="text-muted">Sessions Tracked</p>
            <p className="font-medium text-foreground">{stats.data?.total_sessions ?? "—"}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memberships</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberships.isLoading && <Spinner />}
          {memberships.data?.length === 0 && <EmptyState title="No memberships yet" />}
          {memberships.data?.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span>
                {m.start_date} → {m.end_date ?? "No expiry"}
                {m.remaining_credits != null && <span className="text-muted"> · {m.remaining_credits} credits left</span>}
              </span>
              <StatusBadge status={m.status} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.isLoading && <Spinner />}
          {payments.data?.length === 0 && <EmptyState title="No payments recorded" />}
          {payments.data?.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span>
                ₹{p.amount.toLocaleString()} · {p.method} · {p.payment_date}
                {p.invoice_number && <span className="text-muted"> · {p.invoice_number}</span>}
              </span>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
