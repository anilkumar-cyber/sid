"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Footprints, PencilLine, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { ClassSession, Trainer } from "@/lib/types";

export default function ClassesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ClassesPageContent />
    </Suspense>
  );
}

function ClassesPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [onDate, setOnDate] = useState("");
  const [unsubmittedOnly, setUnsubmittedOnly] = useState(searchParams.get("unsubmitted") === "true");
  const [rescheduleTarget, setRescheduleTarget] = useState<ClassSession | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClassSession | null>(null);
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["classes", { onDate, unsubmittedOnly }],
    queryFn: async () =>
      (await api.get<ClassSession[]>("/classes", { params: { on_date: onDate || undefined, unsubmitted: unsubmittedOnly || undefined } })).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="w-44" value={onDate} onChange={(e) => setOnDate(e.target.value)} />
        {onDate && (
          <Button size="sm" variant="outline" onClick={() => setOnDate("")}>
            Clear
          </Button>
        )}
        {unsubmittedOnly && (
          <Badge tone="danger" className="cursor-pointer" onClick={() => setUnsubmittedOnly(false)}>
            Missing attendance only · click to clear
          </Badge>
        )}
      </div>

      <Card className="divide-y divide-border">
        {isLoading && <Spinner />}
        {isError && <ErrorState />}
        {data?.length === 0 && <EmptyState title="No classes found" icon={Footprints} />}
        {data?.map((session) => (
          <div key={session.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-foreground">{session.batch_name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Clock className="h-3.5 w-3.5" />
                {session.session_date} · {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)} · {session.student_count} students
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={session.status} />
              {user?.role === "trainer" && (
                <Link href={`/attendance/${session.id}`}>
                  <Button size="sm">Attendance</Button>
                </Link>
              )}
              {canManage && session.status !== "cancelled" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setRescheduleTarget(session)}>
                    <PencilLine className="h-3.5 w-3.5" /> Reschedule
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCancelTarget(session)}>
                    <XCircle className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>

      {rescheduleTarget && <RescheduleModal session={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />}
      {cancelTarget && <CancelModal session={cancelTarget} onClose={() => setCancelTarget(null)} />}
    </div>
  );
}

function RescheduleModal({ session, onClose }: { session: ClassSession; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sessionDate, setSessionDate] = useState(session.session_date);
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(session.end_time.slice(0, 5));
  const [trainerId, setTrainerId] = useState(session.trainer_id ?? "");
  const [reason, setReason] = useState("");

  const { data: trainers } = useQuery({ queryKey: ["trainers"], queryFn: async () => (await api.get<Trainer[]>("/trainers")).data });

  const reschedule = useMutation({
    mutationFn: async () =>
      api.patch(`/classes/${session.id}/reschedule`, {
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        trainer_id: trainerId || undefined,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success("Class rescheduled");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Reschedule Class" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{session.batch_name}</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
          </div>
          <div>
            <Label>Start</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Trainer</Label>
          <Select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
            <option value="">Keep current</option>
            {trainers?.map((t) => (
              <option key={t.id} value={t.user_id}>
                {t.full_name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Reason (optional)</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Trainer unavailable" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => reschedule.mutate()} loading={reschedule.isPending}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CancelModal({ session, onClose }: { session: ClassSession; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const cancel = useMutation({
    mutationFn: async () => api.patch(`/classes/${session.id}/cancel`, { reason }),
    onSuccess: () => {
      toast.success("Class cancelled");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Cancel Class" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {session.batch_name} · {session.session_date} · {session.start_time.slice(0, 5)}
        </p>
        <div>
          <Label>Reason</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Studio unavailable due to maintenance" />
        </div>
        <p className="text-xs text-muted">Enrolled students and the trainer will be notified.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant="danger" disabled={!reason.trim()} loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel Class
          </Button>
        </div>
      </div>
    </Modal>
  );
}
