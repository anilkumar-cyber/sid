"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Disc3, Footprints, Music2, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BrandMark } from "@/components/ui/BrandMark";
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

const FOOTSTEPS = [
  { x: 6, y: 88, rotate: -18, side: 1 },
  { x: 16, y: 78, rotate: 12, side: -1 },
  { x: 10, y: 66, rotate: -20, side: 1 },
  { x: 20, y: 55, rotate: 14, side: -1 },
  { x: 14, y: 43, rotate: -16, side: 1 },
  { x: 24, y: 32, rotate: 10, side: -1 },
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 20% 20%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%), radial-gradient(500px circle at 85% 80%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%)",
        }}
      />

      <div className="relative grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-border bg-surface shadow-xl md:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-accent p-10 text-white md:flex">
          {/* decorative dance-step trail */}
          <div className="pointer-events-none absolute inset-0 opacity-25">
            {FOOTSTEPS.map((step, i) => (
              <Footprints
                key={i}
                className="absolute h-6 w-6"
                style={{ left: `${step.x}%`, top: `${step.y}%`, transform: `rotate(${step.rotate}deg) scaleX(${step.side})` }}
              />
            ))}
          </div>
          <Music2 className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-white/10" />
          <Disc3 className="pointer-events-none absolute bottom-24 right-6 h-16 w-16 text-white/10" />

          <div className="relative">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <BrandMark size="sm" className="bg-white/15" />
              Sid Bollywood
            </div>
            <p className="mt-3 text-sm text-white/80">Where every step, beat, and performance comes together.</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
              <PartyPopper className="h-3.5 w-3.5" /> Multi-branch dance academy management platform
            </p>
          </div>

          <div className="relative space-y-3">
            <p className="text-xs uppercase tracking-wide text-white/60">Demo accounts (password: Welcome@123)</p>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => setValue("email", acc.email)}
                  className="flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-left text-xs backdrop-blur-sm hover:bg-white/20"
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
          <p className="mt-1 text-sm text-muted">Sign in and take the floor.</p>

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
