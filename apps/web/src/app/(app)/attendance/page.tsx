"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Clock, X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { ClassSession } from "@/lib/types";

interface CorrectionRequest {
  id: string;
  attendance_record_id: string;
  requested_status: string;
  reason: string;
  status: string;
  requested_by_id: string;
}

export default function AttendancePage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "trainer") return <TrainerAttendanceHome />;
  if (user.role === "admin" || user.role === "super_admin") return <CorrectionsReview />;
  return <EmptyState title="Nothing to show here" />;
}

function TrainerAttendanceHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["classes", "today"],
    queryFn: async () => (await api.get<ClassSession[]>("/classes/today")).data,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Classes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Spinner />}
        {data?.length === 0 && <EmptyState title="No classes today" description="Nothing scheduled — enjoy the day off." />}
        {data?.map((session) => (
          <div key={session.id} className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">{session.batch_name}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)} · {session.student_count} students
                </p>
              </div>
            </div>
            <Link href={`/attendance/${session.id}`}>
              <Button size="sm">Take Attendance</Button>
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CorrectionsReview() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "corrections", "pending"],
    queryFn: async () => (await api.get<CorrectionRequest[]>("/attendance/corrections", { params: { status: "pending" } })).data,
  });

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/attendance/corrections/${id}/${approve ? "approve" : "reject"}`),
    onSuccess: () => {
      toast.success("Correction request reviewed");
      queryClient.invalidateQueries({ queryKey: ["attendance", "corrections", "pending"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Correction Requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Spinner />}
        {data?.length === 0 && <EmptyState title="No pending correction requests" />}
        {data?.map((req) => (
          <div key={req.id} className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="text-sm text-foreground">
                Requested change to <Badge tone="primary">{req.requested_status}</Badge>
              </p>
              <p className="text-sm text-muted">{req.reason}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => review.mutate({ id: req.id, approve: false })}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button size="sm" onClick={() => review.mutate({ id: req.id, approve: true })}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
