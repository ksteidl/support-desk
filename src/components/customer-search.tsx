"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function CustomerSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (value === initial) return;
    const t = setTimeout(() => router.replace(value ? `/customers?q=${encodeURIComponent(value)}` : "/customers"), 250);
    return () => clearTimeout(t);
  }, [value, initial, router]);

  return (
    <div className="relative w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Name oder E-Mail…" className="h-8 pl-8" autoFocus />
    </div>
  );
}
