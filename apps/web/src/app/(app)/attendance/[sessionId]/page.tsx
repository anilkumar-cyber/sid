"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, MinusCircle, TimerReset, Users, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState, Spinner } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { api, apiErrorMessage } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { AttendanceSummary, ClassRoster } from "@/lib/types";

type Status = "present" | "absent" | "late" | "excused";

const STATUS_CONFIG: Record<Status, { label: string; icon: typeof CheckCircle2; activeClass: string; idleClass: string }> = {
  present: { label: "Present", icon: CheckCircle2, activeClass: "bg-success text-white border-success", idleClass: "border-success/30 text-success/60 hover:bg-success/10" },
  absent: { label: "Absent", icon: XCircle, activeClass: "bg-danger text-white border-danger", idleClass: "border-danger/30 text-danger/60 hover:bg-danger/10" },
  late: { label: "Late", icon: Clock, activeClass: "bg-warning text-white border-warning", idleClass: "border-warning/30 text-warning/60 hover:bg-warning/10" },
  excused: { label: "Excused", icon: MinusCircle, activeClass: "bg-info text-white border-info", idleClass: "border-info/30 text-info/60 hover:bg-info/10" },
};
const STATUS_ORDER: Status[] = ["present", "absent", "late", "excused"];
const LEGEND_ICON_CLASS: Record<Status, string> = {
  present: "text-success",
  absent: "text-danger",
  late: "text-warning",
  excused: "text-info",
};

export default function AttendanceSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["attendance", "roster", sessionId],
    queryFn: async () => (await api.get<ClassRoster>(`/attendance/sessions/${sessionId}/roster`)).data,
  });

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, Status> = {};
    data.students.forEach((s) => {
      if (s.existing_status) initial[s.student_id] = s.existing_status as Status;
    });
    setMarks(initial);
  }, [data]);

  const submit = useMutation({
    mutationFn: async () => {
      const records = Object.entries(marks).map(([student_id, status]) => ({ student_id, status }));
      return (
        await api.post(`/attendance/sessions/${sessionId}/submit`, { records })
      ).data as { summary: AttendanceSummary };
    },
    onSuccess: (result) => {
      setSummary(result.summary);
      toast.success("Attendance submitted");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading) return <Spinner label="Loading roster..." />;
  if (isError || !data) return <ErrorState message="Could not load this class's roster." />;

  const markAllPresent = () => {
    const next: Record<string, Status> = {};
    data.students.forEach((s) => {
      next[s.student_id] = "present";
    });
    setMarks(next);
  };

  const setMark = (studentId: string, status: Status) => setMarks((prev) => ({ ...prev, [studentId]: status }));

  const markedCount = Object.keys(marks).length;
  const allMarked = markedCount === data.students.length && data.students.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{data.batch_name}</CardTitle>
            <p className="text-xs text-muted">
              {data.session_date} · {data.start_time.slice(0, 5)} · {data.students.length} students
            </p>
          </div>
          {!summary && (
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              <Users className="h-4 w-4" /> Mark All Present
            </Button>
          )}
        </CardHeader>

        {!summary && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-border px-5 py-3 text-xs text-muted">
            {STATUS_ORDER.map((status) => {
              const { icon: Icon, label } = STATUS_CONFIG[status];
              return (
                <span key={status} className="flex items-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", LEGEND_ICON_CLASS[status])} />
                  {label}
                </span>
              );
            })}
          </div>
        )}

        <CardContent className="space-y-2">
          {data.students.map((student) => {
            const current = marks[student.student_id];
            return (
              <div key={student.student_id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <p className="font-medium text-foreground">{student.full_name}</p>
                <div className="flex gap-1.5">
                  {STATUS_ORDER.map((status) => {
                    const { icon: Icon, activeClass, idleClass, label } = STATUS_CONFIG[status];
                    const isActive = current === status;
                    return (
                      <div key={status} className="group/tip relative">
                        <button
                          disabled={!!summary}
                          onClick={() => setMark(student.student_id, status)}
                          aria-label={label}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                            isActive ? activeClass : idleClass
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity group-hover/tip:opacity-100">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-3 text-center">
            <SummaryStat label="Present" value={summary.present} tone="text-success" />
            <SummaryStat label="Absent" value={summary.absent} tone="text-danger" />
            <SummaryStat label="Late" value={summary.late} tone="text-warning" />
            <SummaryStat label="Excused" value={summary.excused} tone="text-info" />
          </CardContent>
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <Button variant="outline" onClick={() => router.push("/attendance")}>
              Back to Today's Classes
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">
            {markedCount} / {data.students.length} marked
          </p>
          <Button onClick={() => submit.mutate()} loading={submit.isPending} disabled={!allMarked}>
            <TimerReset className="h-4 w-4" /> Submit Attendance
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={cn("text-2xl font-bold", tone)}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
