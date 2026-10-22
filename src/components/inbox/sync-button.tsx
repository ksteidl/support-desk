"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const INTERVAL = 2 * 60_000;

/** Ruft neue Mails ab – beim Öffnen, alle 2 Minuten (wenn sichtbar) und per Klick. */
export function SyncButton({ onSynced }: { onSynced?: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);
  const lastErrors = useRef("");

  const sync = useCallback(
    async (manual = false) => {
      if (busy.current) return;
      busy.current = true;
      setSyncing(true);
      try {
        const res = await fetch("/api/sync", { method: "POST" });
        const data = (await res.json()) as { imported?: number; errors?: { email: string; error: string }[] };
        if (!res.ok) throw new Error("Sync fehlgeschlagen");
        const errors = JSON.stringify(data.errors ?? []);
        if (data.errors?.length && (manual || errors !== lastErrors.current)) {
          data.errors.forEach((e) => toast.error(`${e.email}: ${e.error}`));
        }
        lastErrors.current = errors;
        if (data.imported) {
          toast.success(`${data.imported} neue Nachricht${data.imported === 1 ? "" : "en"}`, {
            description: "KI-Entwürfe werden im Hintergrund erstellt.",
          });
        } else if (manual && !data.errors?.length) {
          toast("Alles aktuell");
        }
        onSynced?.();
      } catch (err) {
        if (manual) toast.error(err instanceof Error ? err.message : "Sync fehlgeschlagen");
      } finally {
        busy.current = false;
        setSyncing(false);
      }
    },
    [onSynced],
  );

  useEffect(() => {
    sync();
    const id = setInterval(() => document.visibilityState === "visible" && sync(), INTERVAL);
    return () => clearInterval(id);
  }, [sync]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={() => sync(true)} disabled={syncing} aria-label="Postfächer abrufen">
          <RefreshCw className={cn(syncing && "animate-spin")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Postfächer abrufen</TooltipContent>
    </Tooltip>
  );
}
