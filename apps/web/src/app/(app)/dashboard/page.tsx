"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock, CreditCard, Footprints, GraduationCap, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/dashboard/StatCard";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ClassSession, Page, RevenueSummary, Student } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "super_admin" || user.role === "admin") return <AdminDashboard />;
  if (user.role === "receptionist") return <ReceptionistDashboard />;
  if (user.role === "trainer") return <TrainerDashboard />;
  if (user.role === "student") return <StudentDashboard />;
  return <PhotographerDashboard />;
}

function AdminDashboard() {
  const summary = useQuery({
    queryKey: ["payments", "summary"],
    queryFn: async () => (await api.get<RevenueSummary>("/payments/summary")).data,
  });
  const students = useQuery({
    queryKey: ["students", "count"],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 1 } })).data,
  });
  const todayClasses = useQuery({
    queryKey: ["classes", "today"],
    queryFn: async () => (await api.get<ClassSession[]>("/classes/today")).data,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={`₹${summary.data?.today_revenue.toLocaleString() ?? "—"}`} icon={Wallet} tone="success" />
        <StatCard label="This Month" value={`₹${summary.data?.month_revenue.toLocaleString() ?? "—"}`} icon={CreditCard} tone="primary" />
        <StatCard label="Total Students" value={students.data?.total ?? "—"} icon={Users} tone="accent" />
        <StatCard label="Classes Today" value={todayClasses.data?.length ?? "—"} icon={CalendarDays} tone="gold" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Action Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ActionRow
            label={`${summary.data?.pending_payments_count ?? 0} pending payments`}
            hint={summary.data ? `₹${summary.data.pending_payments_amount.toLocaleString()} outstanding` : undefined}
            href="/payments"
          />
          <ActionRow label={`${summary.data?.expiring_memberships_count ?? 0} memberships expiring soon`} href="/memberships" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Classes</CardTitle>
          <Link href="/classes" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <TodayClassesList data={todayClasses.data} loading={todayClasses.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

function ReceptionistDashboard() {
  const todayClasses = useQuery({
    queryKey: ["classes", "today"],
    queryFn: async () => (await api.get<ClassSession[]>("/classes/today")).data,
  });
  const summary = useQuery({
    queryKey: ["payments", "summary"],
    queryFn: async () => (await api.get<RevenueSummary>("/payments/summary")).data,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/students"><Button size="sm">New Student</Button></Link>
          <Link href="/payments"><Button size="sm" variant="outline">Record Payment</Button></Link>
          <Link href="/batches"><Button size="sm" variant="outline">Enroll in Batch</Button></Link>
          <Link href="/events"><Button size="sm" variant="outline">Event Registration</Button></Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Pending Payments" value={summary.data?.pending_payments_count ?? "—"} icon={CreditCard} tone="warning" />
        <StatCard label="Memberships Expiring" value={summary.data?.expiring_memberships_count ?? "—"} icon={Wallet} tone="accent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <TodayClassesList data={todayClasses.data} loading={todayClasses.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

function TrainerDashboard() {
  const todayClasses = useQuery({
    queryKey: ["classes", "today"],
    queryFn: async () => (await api.get<ClassSession[]>("/classes/today")).data,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Classes Today" value={todayClasses.data?.length ?? "—"} icon={CalendarDays} tone="primary" />
        <StatCard
          label="Attendance Pending"
          value={todayClasses.data?.filter((c) => c.status !== "cancelled").length ?? "—"}
          icon={CheckCircle2}
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {todayClasses.isLoading && <Spinner />}
          {todayClasses.data?.length === 0 && <EmptyState title="No classes today" description="Enjoy your day off!" icon={Footprints} />}
          {todayClasses.data?.map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium text-foreground">{session.batch_name}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)} · {session.student_count} students
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={session.status} />
                <Link href={`/attendance/${session.id}`}>
                  <Button size="sm">Take Attendance</Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StudentDashboard() {
  const todayClasses = useQuery({
    queryKey: ["classes", "today"],
    queryFn: async () => (await api.get<ClassSession[]>("/classes/today")).data,
  });

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-primary to-accent text-white">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-white/15 p-3">
            <Footprints className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Keep up the rhythm!</p>
            <p className="text-sm text-white/80">Check today's classes and your latest progress below.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <TodayClassesList data={todayClasses.data} loading={todayClasses.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

function PhotographerDashboard() {
  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get("/events")).data,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Events</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/events"><Button>View Events</Button></Link>
          <Link href="/media"><Button variant="outline">Upload Photos / Videos</Button></Link>
        </CardContent>
      </Card>
      <StatCard label="Upcoming Events" value={events.data?.length ?? "—"} icon={CalendarDays} tone="primary" />
    </div>
  );
}

function ActionRow({ label, hint, href }: { label: string; hint?: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-black/[0.02]">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <Badge tone="primary">Review</Badge>
    </Link>
  );
}

function TodayClassesList({ data, loading }: { data?: ClassSession[]; loading: boolean }) {
  if (loading) return <Spinner />;
  if (!data || data.length === 0) return <EmptyState title="No classes scheduled today" icon={Footprints} />;
  return (
    <div className="space-y-2">
      {data.map((session) => (
        <div key={session.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{session.batch_name}</p>
            <p className="text-xs text-muted">
              {format(new Date(session.session_date), "d MMM")} · {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
            </p>
          </div>
          <StatusBadge status={session.status} />
        </div>
      ))}
    </div>
  );
}
