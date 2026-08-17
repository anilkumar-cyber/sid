"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, MapPin, Plus, QrCode, ShoppingCart, Ticket as TicketIcon, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { EventAttendanceSummary, SidEvent, Ticket, TicketType } from "@/lib/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [ticketTypeOpen, setTicketTypeOpen] = useState(false);
  const canManage = user?.role === "super_admin" || user?.role === "admin";
  const canCheckIn = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const event = useQuery({ queryKey: ["events", id], queryFn: async () => (await api.get<SidEvent>(`/events/${id}`)).data });
  const ticketTypes = useQuery({
    queryKey: ["events", id, "ticket-types"],
    queryFn: async () => (await api.get<TicketType[]>(`/events/${id}/ticket-types`)).data,
  });
  const myTickets = useQuery({
    queryKey: ["tickets", "my"],
    queryFn: async () => (await api.get<Ticket[]>("/tickets/my")).data,
  });
  const summary = useQuery({
    queryKey: ["events", id, "attendance-summary"],
    queryFn: async () => (await api.get<EventAttendanceSummary>(`/events/${id}/attendance-summary`)).data,
    enabled: !!canManage,
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
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
      </Card>

      {canManage && summary.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Sold" value={summary.data.tickets_sold} />
          <SummaryTile label="Checked In" value={summary.data.checked_in} />
          <SummaryTile label="No Show" value={summary.data.no_show} />
          <SummaryTile label="Complimentary" value={summary.data.complimentary} />
        </div>
      )}

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
          <CardHeader>
            <CardTitle>My Tickets</CardTitle>
          </CardHeader>
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

      {canCheckIn && <CheckInPanel eventId={id} />}

      {ticketTypeOpen && <CreateTicketTypeModal eventId={id} onClose={() => setTicketTypeOpen(false)} />}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
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
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "attendance-summary"] });
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
