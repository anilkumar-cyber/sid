"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, ArrowLeft, Mail, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Assessment, Certificate, Membership, Payment, Student, StudentAttendanceStat } from "@/lib/types";

const RATING_FIELDS = ["rhythm", "timing", "technique", "expression", "coordination", "performance"] as const;

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);

  const canSeeFinance = user && ["super_admin", "admin", "receptionist", "student"].includes(user.role);

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
    enabled: !!canSeeFinance,
  });
  const payments = useQuery({
    queryKey: ["payments", { student_id: id }],
    queryFn: async () => (await api.get<{ items: Payment[] }>("/payments", { params: { student_id: id } })).data.items,
    enabled: !!canSeeFinance,
  });
  const assessments = useQuery({
    queryKey: ["students", id, "assessments"],
    queryFn: async () => (await api.get<Assessment[]>(`/students/${id}/assessments`)).data,
  });
  const certificates = useQuery({
    queryKey: ["students", id, "certificates"],
    queryFn: async () => (await api.get<Certificate[]>(`/students/${id}/certificates`)).data,
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

      {canSeeFinance && (
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
      )}

      {canSeeFinance && (
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          {user?.role === "trainer" && (
            <Button size="sm" onClick={() => setAssessmentOpen(true)}>
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

      <Card>
        <CardHeader>
          <CardTitle>Certificates</CardTitle>
          {(user?.role === "super_admin" || user?.role === "admin") && (
            <Button size="sm" onClick={() => setCertificateOpen(true)}>
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
                <p className="text-xs text-muted">
                  {c.certificate_number} · {c.issued_date}
                </p>
              </div>
              <Link href={`/verify/${c.verification_code}`} target="_blank" className="text-xs text-primary hover:underline">
                Verify
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      {assessmentOpen && <AddAssessmentModal studentId={id} onClose={() => setAssessmentOpen(false)} />}
      {certificateOpen && <IssueCertificateModal studentId={id} onClose={() => setCertificateOpen(false)} />}
    </div>
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
