import { cn } from "@/lib/utils";

export function StoreDot({ color, className }: { color?: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ backgroundColor: color ?? "#a1a1aa" }} />;
}
