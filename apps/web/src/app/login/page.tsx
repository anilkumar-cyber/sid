"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "superadmin@sidbollywood.com" },
  { role: "Admin", email: "admin.bh@sidbollywood.com" },
  { role: "Receptionist", email: "reception.bh@sidbollywood.com" },
  { role: "Trainer", email: "trainer.arjun@sidbollywood.com" },
  { role: "Photographer", email: "photo.rahul@sidbollywood.com" },
  { role: "Student", email: "meher.student@sidbollywood.com" },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "Welcome@123" } });

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await login(values.email, values.password);
      router.replace("/dashboard");
    } catch (err) {
      setServerError(apiErrorMessage(err, "Invalid email or password."));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-border bg-surface shadow-xl md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-primary to-accent p-10 text-white md:flex">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5" />
              Sid Bollywood
            </div>
            <p className="mt-2 text-sm text-white/80">Multi-branch dance academy management platform</p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-white/60">Demo accounts (password: Welcome@123)</p>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => setValue("email", acc.email)}
                  className="flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-left text-xs hover:bg-white/20"
                >
                  <span>{acc.role}</span>
                  <span className="text-white/70">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage your academy.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@sidbollywood.com" {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
              <FieldError message={errors.password?.message} />
            </div>
            {serverError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>}
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
