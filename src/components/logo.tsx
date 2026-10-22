import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex size-7 items-center justify-center rounded-lg bg-foreground text-background", className)}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7l8 5 8-5" />
        <rect x="3" y="5" width="18" height="14" rx="3" />
      </svg>
    </div>
  );
}
