import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-black/[0.05] text-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  primary: "bg-primary/10 text-primary",
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: Props) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", TONE_CLASSES[tone], className)}
      {...props}
    />
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  paid: "success",
  present: "success",
  approved: "success",
  published: "success",
  checked_in: "success",
  valid: "success",
  pending: "warning",
  trial: "warning",
  late: "warning",
  expiring: "warning",
  pending_approval: "warning",
  frozen: "info",
  waitlisted: "info",
  draft: "neutral",
  inactive: "neutral",
  suspended: "danger",
  cancelled: "danger",
  expired: "danger",
  absent: "danger",
  failed: "danger",
  rejected: "danger",
  former: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
