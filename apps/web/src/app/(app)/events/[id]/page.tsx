"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  MapPin,
  Plus,
  QrCode,
  ShoppingCart,
  Sparkles,
  Ticket as TicketIcon,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { EventActivity, EventParticipant, EventStats, Page, SidEvent, Student, Ticket, TicketType, UserOut } from "@/lib/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [ticketTypeOpen, setTicketTypeOpen] = useState(false);
  const canManage = user?.role === "super_admin" || user?.role === "admin";
  const canCheckIn = user && ["super_admin", "admin", "receptionist"].includes(user.role);
  const canSeeStats = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const event = useQuery({ queryKey: ["events", id], queryFn: async () => (await api.get<SidEvent>(`/events/${id}`)).data });
  const stats = useQuery({
    queryKey: ["events", id, "stats"],
    queryFn: async () => (await api.get<EventStats>(`/events/${id}/stats`)).data,
    enabled: !!canSeeStats,
  });
  const ticketTypes = useQuery({
    queryKey: ["events", id, "ticket-types"],
    queryFn: async () => (await api.get<TicketType[]>(`/events/${id}/ticket-types`)).data,
  });
  const myTickets = useQuery({
    queryKey: ["tickets", "my"],
    queryFn: async () => (await api.get<Ticket[]>("/tickets/my")).data,
  });
  const myTicketsForEvent = myTickets.data?.filter((t) => t.event_id === id) ?? [];

  const buy = useMutation({
    mutationFn: async (ticketTypeId: string) => api.post("/tickets/purchase", { ticket_type_id: ticketTypeId, holder_name: user!.full_name }),
    onSuccess: () => {
      toast.success("Ticket purchased");
      queryClient.invalidateQueries({ queryKey: ["tickets", "my"] });
      queryClient.invalidateQueries({ queryKey: ["events", id, "ticket-types"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (event.isLoading) return <Spinner />;
  if (event.isError || !event.data) return <ErrorState message="Event not found." />;

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "runsheet", label: "Run Sheet", icon: Clock },
    { id: "performances", label: "Performances", icon: Sparkles },
    { id: "tickets", label: "Tickets", icon: TicketIcon },
    ...(canCheckIn ? [{ id: "entry", label: "Entry / QR", icon: QrCode }] : []),
    { id: "media", label: "Media", icon: ImageIcon },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/events" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">{event.data.name}</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted">
              <span>{event.data.event_date}</span>
              {event.data.venue && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.data.venue}</span>
              )}
            </div>
          </div>
          <StatusBadge status={event.data.status} />
        </div>
        {event.data.description && <p className="mt-3 text-sm text-muted">{event.data.description}</p>}

        {canSeeStats && stats.data && (
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 sm:grid-cols-6">
            <StatTile label="Participants" value={stats.data.participants_count} />
            <StatTile label="Tickets Sold" value={stats.data.tickets_sold} />
            <StatTile label="Checked In" value={stats.data.checked_in} />
            <StatTile label="Performances" value={stats.data.performances_count} />
            <StatTile label="Photos" value={stats.data.photos_count} />
            <StatTile label="Videos" value={stats.data.videos_count} />
          </div>
        )}
        {canSeeStats && stats.data && stats.data.revenue > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
            <TrendingUp className="h-4 w-4" /> ₹{stats.data.revenue.toLocaleString()} revenue
          </p>
        )}
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-4">
          {canManage && <PhotographersPanel eventId={id} />}
          <Card>
            <CardHeader><CardTitle>Quick Stats</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted">
              {canSeeStats && stats.data ? (
                <p>
                  {stats.data.participants_count} performers across {stats.data.performances_count} performances ·{" "}
                  {stats.data.tickets_sold} tickets sold ({stats.data.checked_in} checked in) ·{" "}
                  {stats.data.photos_count + stats.data.videos_count} media items published.
                </p>
              ) : (
                <p>Sign in as staff to see event statistics.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "runsheet" && <RunSheetTab eventId={id} canManage={!!canManage} />}
      {tab === "performances" && <PerformancesTab eventId={id} canManage={!!canManage} />}

      {tab === "tickets" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Types</CardTitle>
              {canManage && (
                <Button size="sm" onClick={() => setTicketTypeOpen(true)}>
                  <Plus className="h-4 w-4" /> New Ticket Type
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {ticketTypes.isLoading && <Spinner />}
              {ticketTypes.data?.length === 0 && <EmptyState title="No ticket types yet" />}
              {ticketTypes.data?.map((tt) => (
                <div key={tt.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <TicketIcon className="h-4 w-4 text-muted" />
                    <span className="font-medium text-foreground">{tt.name}</span>
                    <span className="text-muted">₹{tt.price.toLocaleString()} · {tt.available} left</span>
                  </div>
                  <Button size="sm" disabled={tt.available <= 0} loading={buy.isPending} onClick={() => buy.mutate(tt.id)}>
                    <ShoppingCart className="h-3.5 w-3.5" /> Buy
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {myTicketsForEvent.length > 0 && (
            <Card>
              <CardHeader><CardTitle>My Tickets</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {myTicketsForEvent.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{t.ticket_number}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-muted">Code: {t.qr_secret}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "entry" && canCheckIn && <CheckInPanel eventId={id} />}

      {tab === "media" && (
        <Card>
          <CardHeader><CardTitle>Event Media</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canSeeStats && stats.data && (
              <p className="text-sm text-muted">{stats.data.photos_count} photos · {stats.data.videos_count} videos published</p>
            )}
            <Link href={`/media?event_id=${id}`}>
              <Button size="sm" variant="outline">
                <ImageIcon className="h-3.5 w-3.5" /> Open Event Gallery
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {ticketTypeOpen && <CreateTicketTypeModal eventId={id} onClose={() => setTicketTypeOpen(false)} />}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function RunSheetTab({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const activities = useQuery({
    queryKey: ["events", eventId, "activities"],
    queryFn: async () => (await api.get<EventActivity[]>(`/events/${eventId}/activities`)).data,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Sheet</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add to Run Sheet
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {activities.isLoading && <Spinner />}
        {activities.data?.length === 0 && <EmptyState title="Run sheet is empty" description="Add performances, welcome slots, and awards to build the schedule." icon={Clock} />}
        <div className="space-y-2 border-l border-border pl-4">
          {activities.data?.map((a) => (
            <div key={a.id} className="relative pb-2">
              <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-sm">
                <span className="font-mono font-semibold text-foreground">{a.start_time.slice(0, 5)}</span>
                <span className="mx-2 text-muted">—</span>
                <span className="text-foreground">{a.title}</span>
              </p>
              {a.performer_group && <p className="text-xs text-muted">{a.performer_group}</p>}
            </div>
          ))}
        </div>
      </CardContent>
      {open && <CreateActivityModal eventId={eventId} onClose={() => setOpen(false)} />}
    </Card>
  );
}

const activitySchema = z.object({
  title: z.string().min(1, "Title is required"),
  start_time: z.string().min(1, "Select a time"),
  performer_group: z.string().optional(),
  description: z.string().optional(),
});
type ActivityInput = z.infer<typeof activitySchema>;

function CreateActivityModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivityInput>({ resolver: zodResolver(activitySchema) });

  const create = useMutation({
    mutationFn: async (values: ActivityInput) => api.post("/events/activities", { ...values, event_id: eventId }),
    onSuccess: () => {
      toast.success("Added to run sheet");
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "activities"] });
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "stats"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Add to Run Sheet" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input {...register("title")} placeholder="Kids Performance" />
          <FieldError message={errors.title?.message} />
        </div>
        <div>
          <Label>Time</Label>
          <Input type="time" {...register("start_time")} />
          <FieldError message={errors.start_time?.message} />
        </div>
        <div>
          <Label>Performer Group (optional)</Label>
          <Input {...register("performer_group")} placeholder="Bollywood Beginners Batch" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PerformancesTab({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [participantsFor, setParticipantsFor] = useState<EventActivity | null>(null);
  const activities = useQuery({
    queryKey: ["events", eventId, "activities"],
    queryFn: async () => (await api.get<EventActivity[]>(`/events/${eventId}/activities`)).data,
  });

  return (
    <div className="space-y-3">
      {activities.isLoading && <Spinner />}
      {activities.data?.length === 0 && <EmptyState title="No performances yet" description="Add slots to the run sheet first." icon={Sparkles} />}
      {activities.data?.map((a) => (
        <PerformanceCard key={a.id} activity={a} canManage={canManage} onManageParticipants={() => setParticipantsFor(a)} />
      ))}
      {participantsFor && <ParticipantsModal activity={participantsFor} canManage={canManage} onClose={() => setParticipantsFor(null)} />}
    </div>
  );
}

function PerformanceCard({ activity, canManage, onManageParticipants }: { activity: EventActivity; canManage: boolean; onManageParticipants: () => void }) {
  const participants = useQuery({
    queryKey: ["events", "activities", activity.id, "participants"],
    queryFn: async () => (await api.get<EventParticipant[]>(`/events/activities/${activity.id}/participants`)).data,
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{activity.title}</p>
          <p className="text-xs text-muted">{activity.start_time.slice(0, 5)} {activity.performer_group && `· ${activity.performer_group}`}</p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={onManageParticipants}>
            <UserPlus className="h-3.5 w-3.5" /> Participants
          </Button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted" />
        {participants.data?.length === 0 && <span className="text-xs text-muted">No participants added</span>}
        {participants.data?.map((p) => (
          <Badge key={p.id} tone="neutral">{p.guest_name ?? (p.student_id ? "Student" : "Trainer")} · {p.role}</Badge>
        ))}
      </div>
    </Card>
  );
}

function ParticipantsModal({ activity, canManage, onClose }: { activity: EventActivity; canManage: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [studentId, setStudentId] = useState("");
  const { data: students } = useQuery({
    queryKey: ["students", { page_size: 100 }],
    queryFn: async () => (await api.get<Page<Student>>("/students", { params: { page_size: 100 } })).data,
  });
  const participants = useQuery({
    queryKey: ["events", "activities", activity.id, "participants"],
    queryFn: async () => (await api.get<EventParticipant[]>(`/events/activities/${activity.id}/participants`)).data,
  });

  const add = useMutation({
    mutationFn: async () => api.post(`/events/activities/${activity.id}/participants`, { student_ids: [studentId], trainer_ids: [], guest_names: [] }),
    onSuccess: () => {
      toast.success("Participant added");
      setStudentId("");
      queryClient.invalidateQueries({ queryKey: ["events", "activities", activity.id, "participants"] });
      queryClient.invalidateQueries({ queryKey: ["events", activity.event_id, "stats"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const existingIds = new Set(participants.data?.map((p) => p.student_id));

  return (
    <Modal title={`Participants — ${activity.title}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          {participants.data?.length === 0 && <EmptyState title="No participants yet" />}
          {participants.data?.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>{students?.items.find((s) => s.id === p.student_id)?.full_name ?? p.guest_name ?? "Trainer"}</span>
              <Badge tone="primary">{p.role}</Badge>
            </div>
          ))}
        </div>
        {canManage && (
          <div className="flex gap-2 border-t border-border pt-3">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="flex-1">
              <option value="">Select student</option>
              {students?.items.filter((s) => !existingIds.has(s.id)).map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </Select>
            <Button size="sm" disabled={!studentId} loading={add.isPending} onClick={() => add.mutate()}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PhotographersPanel({ eventId }: { eventId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState("");

  const assigned = useQuery({
    queryKey: ["events", eventId, "photographers"],
    queryFn: async () => (await api.get<{ photographer_id: string; full_name: string; email: string }[]>(`/events/${eventId}/photographers`)).data,
  });
  const photographers = useQuery({
    queryKey: ["users", { role: "photographer" }],
    queryFn: async () => (await api.get<Page<UserOut>>("/users", { params: { role: "photographer", page_size: 100 } })).data,
  });

  const assign = useMutation({
    mutationFn: async () => api.post(`/events/${eventId}/photographers`, { photographer_id: selected }),
    onSuccess: () => {
      toast.success("Photographer assigned");
      setSelected("");
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "photographers"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const unassignedOptions = photographers.data?.items.filter((p) => !assigned.data?.some((a) => a.photographer_id === p.id)) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned Photographers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assigned.isLoading && <Spinner />}
        {assigned.data?.length === 0 && <EmptyState title="No photographers assigned yet" description="Only assigned photographers can upload media for this event." />}
        {assigned.data?.map((p) => (
          <div key={p.photographer_id} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm">
            <Camera className="h-4 w-4 text-muted" />
            <span className="font-medium text-foreground">{p.full_name}</span>
            <span className="text-muted">{p.email}</span>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1">
            <option value="">Select a photographer</option>
            {unassignedOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
          <Button size="sm" disabled={!selected} loading={assign.isPending} onClick={() => assign.mutate()}>
            <UserPlus className="h-3.5 w-3.5" /> Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckInPanel({ eventId }: { eventId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ valid: boolean; message: string; ticket: Ticket | null } | null>(null);

  const eventTickets = useQuery({
    queryKey: ["events", eventId, "tickets"],
    queryFn: async () => (await api.get<Ticket[]>(`/events/${eventId}/tickets`)).data,
  });

  const validate = useMutation({
    mutationFn: async () => (await api.post("/tickets/validate", { qr_secret: code })).data as typeof result,
    onSuccess: (data) => {
      setResult(data);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "tickets"] });
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "stats"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entry Check-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) validate.mutate();
          }}
          className="flex gap-2"
        >
          <Input placeholder="Paste ticket code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
          <Button type="submit" loading={validate.isPending} disabled={!code.trim()}>
            <QrCode className="h-4 w-4" /> Validate
          </Button>
        </form>

        {result && (
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
              result.valid ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {result.valid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span>
              {result.message}
              {result.ticket && ` — ${result.ticket.holder_name} (${result.ticket.ticket_number})`}
            </span>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">All Tickets</p>
          <div className="space-y-1.5">
            {eventTickets.isLoading && <Spinner />}
            {eventTickets.data?.length === 0 && <EmptyState title="No tickets sold yet" />}
            {eventTickets.data?.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <span>
                  {t.ticket_number} · {t.holder_name}
                </span>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ticketTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(0),
  quantity_total: z.coerce.number().min(1),
  complimentary_quota: z.coerce.number().min(0).default(0),
});
type TicketTypeInput = z.input<typeof ticketTypeSchema>;
type TicketTypeValues = z.infer<typeof ticketTypeSchema>;

function CreateTicketTypeModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TicketTypeInput, unknown, TicketTypeValues>({ resolver: zodResolver(ticketTypeSchema), defaultValues: { complimentary_quota: 0 } });

  const create = useMutation({
    mutationFn: async (values: TicketTypeValues) => api.post("/ticket-types", { ...values, event_id: eventId }),
    onSuccess: () => {
      toast.success("Ticket type created");
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "ticket-types"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="New Ticket Type" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input {...register("name")} placeholder="VIP" />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Price (₹)</Label>
            <Input type="number" {...register("price")} />
            <FieldError message={errors.price?.message} />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" {...register("quantity_total")} />
            <FieldError message={errors.quantity_total?.message} />
          </div>
          <div>
            <Label>Complimentary</Label>
            <Input type="number" {...register("complimentary_quota")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
