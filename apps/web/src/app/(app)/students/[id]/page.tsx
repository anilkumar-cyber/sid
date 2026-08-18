"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  Award,
  ArrowLeft,
  CalendarDays,
  Clock,
  CreditCard,
  Image as ImageIcon,
  Mail,
  Phone,
  Plus,
  Ticket as TicketIcon,
  TrendingUp,
  Users,
  Video as VideoIcon,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type {
  Assessment,
  AttendanceHistoryEntry,
  Branch,
  Certificate,
  EnrollmentRow,
  Membership,
  Payment,
  Student,
  StudentAttendanceStat,
  StudentOverview,
  StudentPerformance,
  Ticket,
  TimelineEntry,
} from "@/lib/types";

const RATING_FIELDS = ["rhythm", "timing", "technique", "expression", "coordination", "performance"] as const;

interface MediaAsset {
  id: string;
  album_id: string;
  media_type: string;
  url: string;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);

  const canSeeFinance = user && ["super_admin", "admin", "receptionist", "student"].includes(user.role);
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const student = useQuery({ queryKey: ["students", id], queryFn: async () => (await api.get<Student>(`/students/${id}`)).data });
  const overview = useQuery({
    queryKey: ["students", id, "overview"],
    queryFn: async () => (await api.get<StudentOverview>(`/students/${id}/overview`)).data,
  });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: async () => (await api.get<Branch[]>("/branches")).data });
  const branchName = branches?.find((b) => b.id === student.data?.home_branch_id)?.name;

  if (student.isLoading) return <Spinner />;
  if (student.isError || !student.data) return <ErrorState message="Student not found." />;

  const s = student.data;

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "classes", label: "Classes", icon: CalendarDays },
    { id: "enrollment", label: "Enrollment" },
    { id: "attendance", label: "Attendance" },
    ...(canSeeFinance ? [{ id: "membership", label: "Membership", icon: Wallet }] : []),
    ...(canSeeFinance ? [{ id: "payments", label: "Payments", icon: CreditCard }] : []),
    { id: "events", label: "Events" },
    ...(canSeeFinance ? [{ id: "tickets", label: "Tickets", icon: TicketIcon }] : []),
    { id: "photos", label: "Photos", icon: ImageIcon },
    { id: "videos", label: "Videos", icon: VideoIcon },
    { id: "progress", label: "Progress", icon: TrendingUp },
    { id: "certificates", label: "Certificates", icon: Award },
    { id: "activity", label: "Activity", icon: ActivityIcon },
  ];

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
              {branchName && <span>{branchName}</span>}
            </div>
          </div>
          <StatusBadge status={s.status} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted">Current Batch</p>
            <p className="font-medium text-foreground">{overview.data?.current_batches[0]?.batch_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted">Membership</p>
            {overview.data?.current_membership ? <StatusBadge status={overview.data.current_membership.status} /> : <p className="font-medium text-foreground">—</p>}
          </div>
          <div>
            <p className="text-muted">Attendance</p>
            <p className="font-medium text-foreground">{overview.data?.attendance_percent != null ? `${overview.data.attendance_percent}%` : "—"}</p>
          </div>
          <div>
            <p className="text-muted">Payment Status</p>
            <p className="font-medium text-foreground">
              {overview.data ? (overview.data.outstanding_payment_amount > 0 ? `₹${overview.data.outstanding_payment_amount.toLocaleString()} due` : "Clear") : "—"}
            </p>
          </div>
        </div>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab overview={overview.data} onNavigate={setTab} />}
      {tab === "classes" && <ClassesTab studentId={id} active={tab === "classes"} />}
      {tab === "enrollment" && <EnrollmentTab studentId={id} active={tab === "enrollment"} />}
      {tab === "attendance" && <AttendanceTab studentId={id} active={tab === "attendance"} />}
      {tab === "membership" && canSeeFinance && <MembershipTab studentId={id} active={tab === "membership"} />}
      {tab === "payments" && canSeeFinance && <PaymentsTab studentId={id} active={tab === "payments"} />}
      {tab === "events" && <EventsTab studentId={id} active={tab === "events"} />}
      {tab === "tickets" && canSeeFinance && <TicketsTab studentId={id} active={tab === "tickets"} />}
      {tab === "photos" && <MediaTab studentId={id} active={tab === "photos"} mediaType="photo" />}
      {tab === "videos" && <MediaTab studentId={id} active={tab === "videos"} mediaType="video" />}
      {tab === "progress" && (
        <ProgressTab studentId={id} active={tab === "progress"} canAdd={user?.role === "trainer"} onAdd={() => setAssessmentOpen(true)} />
      )}
      {tab === "certificates" && (
        <CertificatesTab studentId={id} active={tab === "certificates"} canIssue={!!canManage} onIssue={() => setCertificateOpen(true)} />
      )}
      {tab === "activity" && <ActivityTab studentId={id} active={tab === "activity"} />}

      {assessmentOpen && <AddAssessmentModal studentId={id} onClose={() => setAssessmentOpen(false)} />}
      {certificateOpen && <IssueCertificateModal studentId={id} onClose={() => setCertificateOpen(false)} />}
    </div>
  );
}

function OverviewTab({ overview, onNavigate }: { overview?: StudentOverview; onNavigate: (tab: string) => void }) {
  if (!overview) return <Spinner />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase text-muted">Next Class</p>
        {overview.next_class ? (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span>{overview.next_class.batch_name} · {overview.next_class.session_date} at {overview.next_class.start_time}</span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No upcoming class scheduled</p>
        )}
      </Card>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase text-muted">Upcoming Events</p>
        <button onClick={() => onNavigate("events")} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <TicketIcon className="h-4 w-4" /> {overview.upcoming_events_count} upcoming
        </button>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase text-muted">Outstanding Payment</p>
        <button onClick={() => onNavigate("payments")} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <Wallet className="h-4 w-4" /> ₹{overview.outstanding_payment_amount.toLocaleString()}
        </button>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase text-muted">Recent Achievement</p>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <Award className="h-4 w-4 text-gold" /> {overview.recent_certificate_title ?? "None yet"}
        </p>
      </Card>
      <Card className="p-4 sm:col-span-2">
        <p className="text-xs font-semibold uppercase text-muted">Current Batches</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {overview.current_batches.length === 0 && <p className="text-sm text-muted">Not enrolled in any batch</p>}
          {overview.current_batches.map((b) => (
            <Badge key={b.batch_id} tone="primary">
              <Users className="mr-1 inline h-3 w-3" /> {b.batch_name}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ClassesTab({ studentId, active }: { studentId: string; active: boolean }) {
  const enrollments = useQuery({
    queryKey: ["enrollments", { student_id: studentId, status: "active" }],
    queryFn: async () => (await api.get<EnrollmentRow[]>("/enrollments", { params: { student_id: studentId, status: "active" } })).data,
    enabled: active,
  });
  const { data: batches } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/batches")).data,
    enabled: active,
  });
  const batchIds = useMemo(() => enrollments.data?.map((e) => e.batch_id) ?? [], [enrollments.data]);
  const classes = useQuery({
    queryKey: ["classes", "student", batchIds],
    queryFn: async () => {
      const results = await Promise.all(batchIds.map((bid) => api.get(`/classes`, { params: { batch_id: bid } })));
      return results.flatMap((r) => r.data as { id: string; batch_name: string; session_date: string; start_time: string; status: string }[]);
    },
    enabled: active && batchIds.length > 0,
  });

  return (
    <Card>
      <CardHeader><CardTitle>Enrolled Classes</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {enrollments.isLoading && <Spinner />}
        {enrollments.data?.length === 0 && <EmptyState title="Not enrolled in any classes" />}
        {enrollments.data?.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
            <span className="font-medium text-foreground">{batches?.find((b) => b.id === e.batch_id)?.name ?? e.batch_id}</span>
            <span className="text-xs text-muted">Since {e.enrolled_date}</span>
          </div>
        ))}
        {!!classes.data?.length && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Upcoming Sessions</p>
            {classes.data
              .filter((c) => c.session_date >= new Date().toISOString().slice(0, 10))
              .slice(0, 10)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between px-1 py-1.5 text-sm">
                  <span>{c.batch_name} · {c.session_date} {c.start_time.slice(0, 5)}</span>
                  <StatusBadge status={c.status} />
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EnrollmentTab({ studentId, active }: { studentId: string; active: boolean }) {
  const enrollments = useQuery({
    queryKey: ["enrollments", { student_id: studentId }],
    queryFn: async () => (await api.get<EnrollmentRow[]>("/enrollments", { params: { student_id: studentId } })).data,
    enabled: active,
  });
  const { data: batches } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/batches")).data,
    enabled: active,
  });

  return (
    <Card>
      <CardHeader><CardTitle>Enrollment History</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {enrollments.isLoading && <Spinner />}
        {enrollments.data?.length === 0 && <EmptyState title="No enrollment records" />}
        {enrollments.data?.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-foreground">{batches?.find((b) => b.id === e.batch_id)?.name ?? e.batch_id}</p>
              <p className="text-xs text-muted">Enrolled {e.enrolled_date}{e.waitlist_position != null && ` · Waitlist #${e.waitlist_position}`}</p>
            </div>
            <StatusBadge status={e.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AttendanceTab({ studentId, active }: { studentId: string; active: boolean }) {
  const stats = useQuery({
    queryKey: ["attendance", "stats", studentId],
    queryFn: async () => (await api.get<StudentAttendanceStat>(`/attendance/students/${studentId}/stats`)).data,
    enabled: active,
  });
  const history = useQuery({
    queryKey: ["attendance", "history", studentId],
    queryFn: async () => (await api.get<AttendanceHistoryEntry[]>(`/attendance/students/${studentId}/history`)).data,
    enabled: active,
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div><p className="text-xs text-muted">Overall</p><p className="text-lg font-bold text-primary">{stats.data?.attendance_percent ?? 0}%</p></div>
          <div><p className="text-xs text-muted">Present</p><p className="text-lg font-bold text-success">{stats.data?.present ?? 0}</p></div>
          <div><p className="text-xs text-muted">Absent</p><p className="text-lg font-bold text-danger">{stats.data?.absent ?? 0}</p></div>
          <div><p className="text-xs text-muted">Late</p><p className="text-lg font-bold text-warning">{stats.data?.late ?? 0}</p></div>
          <div><p className="text-xs text-muted">Excused</p><p className="text-lg font-bold text-info">{stats.data?.excused ?? 0}</p></div>
        </div>
      </Card>
      <Card>
        <CardHeader><CardTitle>Attendance History</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {history.isLoading && <Spinner />}
          {history.data?.length === 0 && <EmptyState title="No attendance recorded yet" />}
          {history.data?.map((h) => (
            <div key={h.class_session_id} className="flex items-center justify-between px-1 py-1.5 text-sm">
              <span>{h.session_date} · {h.batch_name ?? "—"}</span>
              <StatusBadge status={h.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MembershipTab({ studentId, active }: { studentId: string; active: boolean }) {
  const memberships = useQuery({
    queryKey: ["memberships", { student_id: studentId }],
    queryFn: async () => (await api.get<Membership[]>("/memberships", { params: { student_id: studentId } })).data,
    enabled: active,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Memberships</CardTitle></CardHeader>
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
  );
}

function PaymentsTab({ studentId, active }: { studentId: string; active: boolean }) {
  const payments = useQuery({
    queryKey: ["payments", { student_id: studentId }],
    queryFn: async () => (await api.get<{ items: Payment[] }>("/payments", { params: { student_id: studentId } })).data.items,
    enabled: active,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
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
  );
}

function EventsTab({ studentId, active }: { studentId: string; active: boolean }) {
  const performances = useQuery({
    queryKey: ["students", studentId, "performances"],
    queryFn: async () => (await api.get<StudentPerformance[]>(`/students/${studentId}/performances`)).data,
    enabled: active,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Performances & Events</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {performances.isLoading && <Spinner />}
        {performances.data?.length === 0 && <EmptyState title="No event participation yet" />}
        {performances.data?.map((p) => (
          <Link key={p.activity_id} href={`/events/${p.event_id}`} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-black/[0.02]">
            <div>
              <p className="font-medium text-foreground">{p.activity_title}</p>
              <p className="text-xs text-muted">{p.event_name} · {p.event_date}</p>
            </div>
            <Badge tone="primary">{p.role}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function TicketsTab({ studentId, active }: { studentId: string; active: boolean }) {
  const tickets = useQuery({
    queryKey: ["students", studentId, "tickets"],
    queryFn: async () => (await api.get<Ticket[]>(`/students/${studentId}/tickets`)).data,
    enabled: active,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Tickets</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {tickets.isLoading && <Spinner />}
        {tickets.data?.length === 0 && <EmptyState title="No tickets purchased" />}
        {tickets.data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
            <span>{t.ticket_number} · ₹{t.amount_paid.toLocaleString()}</span>
            <StatusBadge status={t.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MediaTab({ studentId, active, mediaType }: { studentId: string; active: boolean; mediaType: "photo" | "video" }) {
  const media = useQuery({
    queryKey: ["students", studentId, "media"],
    queryFn: async () => (await api.get<MediaAsset[]>(`/students/${studentId}/media`)).data,
    enabled: active,
  });
  const filtered = media.data?.filter((m) => m.media_type === mediaType) ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>{mediaType === "photo" ? "Photos" : "Videos"}</CardTitle></CardHeader>
      <CardContent>
        {media.isLoading && <Spinner />}
        {media.data && filtered.length === 0 && <EmptyState title={`No ${mediaType}s yet`} icon={mediaType === "photo" ? ImageIcon : VideoIcon} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {filtered.map((m) => (
            <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
              {mediaType === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnail_url ?? m.url} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <video src={m.url} className="aspect-square w-full object-cover" muted />
              )}
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressTab({ studentId, active, canAdd, onAdd }: { studentId: string; active: boolean; canAdd: boolean; onAdd: () => void }) {
  const assessments = useQuery({
    queryKey: ["students", studentId, "assessments"],
    queryFn: async () => (await api.get<Assessment[]>(`/students/${studentId}/assessments`)).data,
    enabled: active,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress</CardTitle>
        {canAdd && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add Assessment
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {assessments.isLoading && <Spinner />}
        {assessments.data?.length === 0 && <EmptyState title="No assessments yet" />}
        {assessments.data?.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-4 text-sm">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {RATING_FIELDS.map((field) => (
                <div key={field} className="text-center">
                  <p className="text-lg font-bold text-primary">{a[field]}/5</p>
                  <p className="text-[11px] capitalize text-muted">{field}</p>
                </div>
              ))}
            </div>
            {a.comments && <p className="mt-3 text-muted">{a.comments}</p>}
            <p className="mt-2 text-xs text-muted">{new Date(a.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CertificatesTab({ studentId, active, canIssue, onIssue }: { studentId: string; active: boolean; canIssue: boolean; onIssue: () => void }) {
  const certificates = useQuery({
    queryKey: ["students", studentId, "certificates"],
    queryFn: async () => (await api.get<Certificate[]>(`/students/${studentId}/certificates`)).data,
    enabled: active,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificates</CardTitle>
        {canIssue && (
          <Button size="sm" onClick={onIssue}>
            <Plus className="h-4 w-4" /> Issue Certificate
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {certificates.isLoading && <Spinner />}
        {certificates.data?.length === 0 && <EmptyState title="No certificates issued yet" />}
        {certificates.data?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
            <Award className="h-4 w-4 text-gold" />
            <div className="flex-1">
              <p className="font-medium text-foreground">{c.title}</p>
              <p className="text-xs text-muted">{c.certificate_number} · {c.issued_date}</p>
            </div>
            <Link href={`/verify/${c.verification_code}`} target="_blank" className="text-xs text-primary hover:underline">
              Verify
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityTab({ studentId, active }: { studentId: string; active: boolean }) {
  const timeline = useQuery({
    queryKey: ["students", studentId, "timeline"],
    queryFn: async () => (await api.get<{ entries: TimelineEntry[] }>(`/students/${studentId}/timeline`)).data.entries,
    enabled: active,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
      <CardContent>
        {timeline.isLoading && <Spinner />}
        {timeline.data?.length === 0 && <EmptyState title="No activity recorded yet" />}
        <div className="space-y-4 border-l border-border pl-4">
          {timeline.data?.map((entry, idx) => (
            <div key={idx} className="relative">
              <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-sm font-medium text-foreground">
                {entry.link ? <Link href={entry.link} className="hover:underline">{entry.title}</Link> : entry.title}
              </p>
              {entry.description && <p className="text-xs text-muted">{entry.description}</p>}
              <p className="text-xs text-muted">{new Date(entry.date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AddAssessmentModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [ratings, setRatings] = useState<Record<(typeof RATING_FIELDS)[number], number>>({
    rhythm: 3,
    timing: 3,
    technique: 3,
    expression: 3,
    coordination: 3,
    performance: 3,
  });
  const [comments, setComments] = useState("");

  const submit = useMutation({
    mutationFn: async () => api.post("/assessments", { student_id: studentId, ...ratings, comments: comments || undefined }),
    onSuccess: () => {
      toast.success("Assessment saved");
      queryClient.invalidateQueries({ queryKey: ["students", studentId, "assessments"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Add Assessment" onClose={onClose}>
      <div className="space-y-4">
        {RATING_FIELDS.map((field) => (
          <div key={field}>
            <div className="mb-1 flex items-center justify-between">
              <Label className="mb-0 capitalize">{field}</Label>
              <span className="text-sm font-semibold text-primary">{ratings[field]}/5</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={ratings[field]}
              onChange={(e) => setRatings((prev) => ({ ...prev, [field]: Number(e.target.value) }))}
              className="w-full"
            />
          </div>
        ))}
        <div>
          <Label>Comments</Label>
          <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Notes for the student..." />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            Save Assessment
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function IssueCertificateModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [achievementType, setAchievementType] = useState("course_completion");

  const submit = useMutation({
    mutationFn: async () => api.post("/certificates", { student_id: studentId, achievement_type: achievementType, title }),
    onSuccess: () => {
      toast.success("Certificate issued");
      queryClient.invalidateQueries({ queryKey: ["students", studentId, "certificates"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Issue Certificate" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bollywood Beginner — Course Completion" />
        </div>
        <div>
          <Label>Achievement Type</Label>
          <Select value={achievementType} onChange={(e) => setAchievementType(e.target.value)}>
            <option value="course_completion">Course Completion</option>
            <option value="event_participation">Event Participation</option>
            <option value="competition">Competition</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim()} loading={submit.isPending} onClick={() => submit.mutate()}>
            Issue Certificate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
