import { AlertCircle, Inbox, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong. Please try again." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <AlertCircle className="h-8 w-8 text-danger" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="rounded-full bg-primary/[0.06] p-3">
        <Icon className="h-6 w-6 text-primary/60" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
