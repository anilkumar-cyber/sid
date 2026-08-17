"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { FieldError, Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { Branch, Page, Student } from "@/lib/types";

const schema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  home_branch_id: z.string().min(1, "Select a branch"),
  skill_level: z.string().optional(),
  status: z.enum(["trial", "active", "inactive", "suspended", "former"]).default("trial"),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export default function StudentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const canManage = user && ["super_admin", "admin", "receptionist"].includes(user.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["students", { search, status, page }],
    queryFn: async () =>
      (
        await api.get<Page<Student>>("/students", {
          params: { search: search || undefined, status: status || undefined, page, page_size: 15 },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="w-64 pl-9"
              placeholder="Search students..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="former">Former</option>
          </Select>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Student
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto">
        {isLoading && <Spinner />}
        {isError && <ErrorState />}
        {data?.items.length === 0 && <EmptyState title="No students found" description="Try adjusting your filters." />}
        {!!data?.items.length && (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-black/[0.02] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Skill Level</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((student) => (
                <tr key={student.id} className="border-b border-border last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/students/${student.id}`} className="font-medium text-foreground hover:text-primary">
                      {student.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{student.email}</td>
                  <td className="px-4 py-3 text-muted capitalize">{student.skill_level ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{student.joining_date}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={student.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {!!data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Page {data.page} of {Math.ceil(data.total / data.page_size)} · {data.total} students
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page * data.page_size >= data.total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {open && <CreateStudentModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function CreateStudentModal({ onClose }: { onClose: () => void }) {
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
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: { status: "trial" } });

  const create = useMutation({
    mutationFn: async (values: FormValues) => api.post("/students", values),
    onSuccess: () => {
      toast.success("Student registered");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Modal title="Register New Student" onClose={onClose}>
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
            <Label>Skill Level</Label>
            <Input {...register("skill_level")} placeholder="Beginner" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <Label>Status</Label>
            <Select {...register("status")}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted">A default password (Welcome@123) is set; the student will be asked to change it on first login.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Register Student
          </Button>
        </div>
      </form>
    </Modal>
  );
}
