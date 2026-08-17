"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Branch } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(2, "Code is required").max(20),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  opening_hours: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function BranchesPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/branches")).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Manage every Sid Bollywood branch from here.</p>
        {user?.role === "super_admin" && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Branch
          </Button>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {data?.length === 0 && <EmptyState title="No branches yet" description="Create your first branch to get started." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((branch) => (
          <Card key={branch.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{branch.name}</p>
                  <p className="text-xs text-muted">{branch.code}</p>
                </div>
              </div>
              <Badge tone={branch.is_active ? "success" : "neutral"}>{branch.is_active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted">
              {branch.address && <p>{branch.address}</p>}
              {branch.phone && <p>{branch.phone}</p>}
              {branch.opening_hours && <p>{branch.opening_hours}</p>}
            </div>
          </Card>
        ))}
      </div>

      {open && <CreateBranchModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function CreateBranchModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/branches", values),
    onSuccess: () => {
      toast.success("Branch created");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="New Branch" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div>
          <Label>Branch Name</Label>
          <Input {...register("name")} placeholder="e.g. Kondapur" />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label>Branch Code</Label>
          <Input {...register("code")} placeholder="e.g. KND" />
          <FieldError message={errors.code?.message} />
        </div>
        <div>
          <Label>Address</Label>
          <Textarea rows={2} {...register("address")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Phone</Label>
            <Input {...register("phone")} />
          </div>
          <div>
            <Label>Email</Label>
            <Input {...register("email")} />
          </div>
        </div>
        <div>
          <Label>Opening Hours</Label>
          <Input {...register("opening_hours")} placeholder="7:00 AM - 9:00 PM" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Create Branch
          </Button>
        </div>
      </form>
    </Modal>
  );
}
