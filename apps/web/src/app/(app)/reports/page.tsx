"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Ticket, TrendingUp, Users } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { api } from "@/lib/api";

interface StudentReport {
  active: number;
  inactive: number;
  trial: number;
  suspended: number;
  former: number;
  new_this_month: number;
}
interface AttendanceReport {
  total_sessions: number;
  total_records: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate_percent: number;
}
interface OccupancyRow {
  batch_id: string;
  batch_name: string;
  capacity: number;
  enrolled: number;
  occupancy_percent: number;
}
interface EventReportRow {
  event_id: string;
  event_name: string;
  tickets_sold: number;
  revenue: number;
  checked_in: number;
}

export default function ReportsPage() {
  const students = useQuery({ queryKey: ["reports", "students"], queryFn: async () => (await api.get<StudentReport>("/reports/students")).data });
  const attendance = useQuery({ queryKey: ["reports", "attendance"], queryFn: async () => (await api.get<AttendanceReport>("/reports/attendance")).data });
  const occupancy = useQuery({ queryKey: ["reports", "occupancy"], queryFn: async () => (await api.get<OccupancyRow[]>("/reports/occupancy")).data });
  const events = useQuery({ queryKey: ["reports", "events"], queryFn: async () => (await api.get<EventReportRow[]>("/reports/events")).data });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Students" value={students.data?.active ?? "—"} icon={Users} tone="success" />
        <StatCard label="New This Month" value={students.data?.new_this_month ?? "—"} icon={Users} tone="primary" />
        <StatCard label="Attendance Rate" value={attendance.data ? `${attendance.data.attendance_rate_percent}%` : "—"} icon={CalendarCheck} tone="accent" />
        <StatCard label="Trial Students" value={students.data?.trial ?? "—"} icon={TrendingUp} tone="gold" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Occupancy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {occupancy.isLoading && <Spinner />}
          {occupancy.data?.length === 0 && <EmptyState title="No batches yet" />}
          {occupancy.data?.map((row) => (
            <div key={row.batch_id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{row.batch_name}</span>
              <span className="text-muted">
                {row.enrolled}/{row.capacity} · {row.occupancy_percent}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.isLoading && <Spinner />}
          {events.data?.length === 0 && <EmptyState title="No events yet" />}
          {events.data?.map((row) => (
            <div key={row.event_id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Ticket className="h-4 w-4 text-muted" /> {row.event_name}
              </span>
              <span className="text-muted">
                {row.tickets_sold} sold · {row.checked_in} checked in · ₹{row.revenue.toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
