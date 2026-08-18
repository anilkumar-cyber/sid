import { Footprints } from "lucide-react";

import { cn } from "@/lib/cn";

export function BrandMark({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = { sm: "h-8 w-8 rounded-lg", md: "h-10 w-10 rounded-xl", lg: "h-12 w-12 rounded-2xl" };
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-primary to-accent text-white",
        sizeClasses[size],
        className
      )}
    >
      <Footprints className={iconSizes[size]} />
    </div>
  );
}
