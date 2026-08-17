"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { SidEvent } from "@/lib/types";

export default function EventsPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const canManage = user?.role === "super_admin" || user?.role === "admin";

  const { data, isLoading, isError } = useQuery({ queryKey: ["events"], queryFn: async () => (await api.get<SidEvent[]>("/events")).data });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Academy showcases, competitions, and celebrations.</p>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Event
          </Button>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No events yet" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`}>
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary to-accent text-white">
                <Ticket className="h-8 w-8" />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{event.name}</p>
                  <StatusBadge status={event.status} />
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {event.event_date}</p>
                  {event.venue && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.venue}</p>}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {open && <CreateEventModal onClose={() => setOpen(false)} />}
    </div>
  );
}

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  event_date: z.string().min(1, "Select a date"),
  venue: z.string().optional(),
  scope: z.enum(["branch", "multi_branch", "academy_wide"]).default("academy_wide"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: { scope: "academy_wide" } });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/events", values),
    onSuccess: () => {
      toast.success("Event created");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="New Event" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Event Name</Label>
          <Input {...register("name")} placeholder="Annual Day 2026" />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} {...register("description")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" {...register("event_date")} />
            <FieldError message={errors.event_date?.message} />
          </div>
          <div>
            <Label>Venue</Label>
            <Input {...register("venue")} />
          </div>
        </div>
        <div>
          <Label>Scope</Label>
          <Select {...register("scope")}>
            <option value="branch">Branch</option>
            <option value="multi_branch">Multi Branch</option>
            <option value="academy_wide">Academy Wide</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Create Event
          </Button>
        </div>
      </form>
    </Modal>
  );
}
