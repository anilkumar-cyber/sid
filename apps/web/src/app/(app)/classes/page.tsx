"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ClassSession } from "@/lib/types";

export default function ClassesPage() {
  const { user } = useAuth();
  const [onDate, setOnDate] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["classes", { onDate }],
    queryFn: async () => (await api.get<ClassSession[]>("/classes", { params: { on_date: onDate || undefined } })).data,
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
      </div>

      <Card className="divide-y divide-border">
        {isLoading && <Spinner />}
        {isError && <ErrorState />}
        {data?.length === 0 && <EmptyState title="No classes found" />}
        {data?.map((session) => (
          <div key={session.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-foreground">{session.batch_name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Clock className="h-3.5 w-3.5" />
                {session.session_date} · {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)} · {session.student_count} students
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={session.status} />
              {user?.role === "trainer" && (
                <Link href={`/attendance/${session.id}`}>
                  <Button size="sm">Attendance</Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
