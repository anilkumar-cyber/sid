"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Branch, Trainer } from "@/lib/types";

const schema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  experience_years: z.coerce.number().min(0).optional(),
  home_branch_id: z.string().min(1, "Select a branch"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export default function TrainersPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const canManage = user?.role === "super_admin" || user?.role === "admin";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["trainers"],
    queryFn: async () => (await api.get<Trainer[]>("/trainers")).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Choreographers and instructors across all branches.</p>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Trainer
          </Button>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No trainers yet" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((trainer) => (
          <Card key={trainer.id} className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{trainer.full_name}</p>
                <p className="text-xs text-muted">{trainer.email}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted">
              {trainer.specialization && <p>{trainer.specialization}</p>}
              {trainer.experience_years != null && <p>{trainer.experience_years} years experience</p>}
            </div>
          </Card>
        ))}
      </div>

      {open && <CreateTrainerModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function CreateTrainerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/branches")).data,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/trainers", values),
    onSuccess: () => {
      toast.success("Trainer added");
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="New Trainer" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Full Name</Label>
          <Input {...register("full_name")} />
          <FieldError message={errors.full_name?.message} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Phone</Label>
            <Input {...register("phone")} />
          </div>
          <div>
            <Label>Experience (years)</Label>
            <Input type="number" {...register("experience_years")} />
          </div>
        </div>
        <div>
          <Label>Specialization</Label>
          <Input {...register("specialization")} placeholder="Bollywood, Hip Hop" />
        </div>
        <div>
          <Label>Home Branch</Label>
          <Select {...register("home_branch_id")}>
            <option value="">Select branch</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <FieldError message={errors.home_branch_id?.message} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Add Trainer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
