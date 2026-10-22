"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { ArrowUp, Check, Loader2, RotateCcw, Send, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { regenerateDraft, saveDraft, sendReply } from "@/app/actions/tickets";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { relative } from "@/lib/format";
import type { Draft } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK = ["Kürzer", "Freundlicher", "Formeller", "Mehr Empathie", "Auf Englisch"];

export interface ComposerHandle {
  focus: () => void;
  regenerate: () => void;
}

export const Composer = forwardRef<
  ComposerHandle,
  { ticketId: string; draft: Draft | null; aiEnabled: boolean; fromEmail: string; onSent: (closed: boolean) => void }
>(function Composer({ ticketId, draft, aiEnabled, fromEmail, onSent }, ref) {
  const [body, setBody] = useState(draft?.body ?? "");
  const [original, setOriginal] = useState(draft?.body ?? "");
  const [attention, setAttention] = useState(draft?.needs_attention ? (draft.reasoning ?? "Bitte prüfen") : null);
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, startSending] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const edited = body !== original;

  // Neuer KI-Entwurf aus dem Hintergrund: nur übernehmen, wenn nichts bearbeitet wurde
  const lastGenerated = useRef(draft?.generated_at);
  useEffect(() => {
    if (draft?.generated_at === lastGenerated.current) return;
    lastGenerated.current = draft?.generated_at;
    if (draft?.model && (!edited || !body.trim())) {
      setBody(draft.body);
      setOriginal(draft.body);
      setAttention(draft.needs_attention ? (draft.reasoning ?? "Bitte prüfen") : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Autosave
  useEffect(() => {
    if (body === (draft?.body ?? "")) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(ticketId, body), 800);
    return () => clearTimeout(saveTimer.current);
  }, [body, ticketId, draft?.body]);

  // Auto-Höhe
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.5)}px`;
  }, [body]);

  async function generate(instr?: string) {
    if (!aiEnabled) return toast.error("ANTHROPIC_API_KEY ist nicht konfiguriert");
    setGenerating(true);
    const res = await regenerateDraft(ticketId, instr, instr ? body : undefined);
    setGenerating(false);
    if (!res.ok) return toast.error(res.error);
    setBody(res.body ?? "");
    setOriginal(res.body ?? "");
    setAttention(res.needsAttention ? res.reason || "Bitte prüfen" : null);
    setInstruction("");
  }

  function send(close: boolean) {
    if (!body.trim() || sending) return;
    startSending(async () => {
      clearTimeout(saveTimer.current);
      const res = await sendReply(ticketId, body, close);
      if (!res.ok) return void toast.error(res.error);
      toast.success(close ? "Gesendet & erledigt" : "Antwort gesendet");
      onSent(close);
    });
  }

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    regenerate: () => {
      if (generating) return;
      if (edited && body.trim() && !confirm("Deine Änderungen verwerfen und neu generieren?")) return;
      generate();
    },
  }));

  return (
    <div className="rounded-xl border bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring/20">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {draft?.model ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ai">
            <Sparkles className="size-3.5" />
            {edited ? "KI-Entwurf · bearbeitet" : "KI-Entwurf"}
          </span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">Antwort</span>
        )}
        {draft?.generated_at && !edited && (
          <span className="text-xs text-muted-foreground">· {relative(draft.generated_at)}</span>
        )}
        <span className="ml-auto truncate text-xs text-muted-foreground">von {fromEmail}</span>
        {edited && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={() => setBody(original)} aria-label="Änderungen verwerfen">
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Auf KI-Version zurücksetzen</TooltipContent>
          </Tooltip>
        )}
      </div>

      {attention && (
        <div className="flex items-start gap-2 border-b bg-amber-500/10 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{attention}</span>
        </div>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              send(e.shiftKey);
            }
            if (e.key === "Escape") textareaRef.current?.blur();
          }}
          placeholder={aiEnabled ? "Antwort schreiben oder KI-Entwurf generieren…" : "Antwort schreiben…"}
          className={cn(
            "block min-h-40 w-full resize-none bg-transparent px-4 py-3 leading-relaxed outline-none placeholder:text-muted-foreground",
            generating && "opacity-40",
          )}
          disabled={generating}
        />
        {generating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow-sm">
              <Loader2 className="size-3.5 animate-spin text-ai" /> Bestellung wird gescannt & Antwort geschrieben…
            </span>
          </div>
        )}
        {!body && !generating && aiEnabled && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <Button size="sm" variant="secondary" onClick={() => generate()}>
              <Sparkles className="text-ai" /> Entwurf generieren <Kbd>G</Kbd>
            </Button>
          </div>
        )}
      </div>

      {aiEnabled && body && (
        <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto border-t px-3 py-2">
          <form
            className="relative min-w-56 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (instruction.trim()) generate(instruction);
            }}
          >
            <Wand2 className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ai" />
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={generating}
              placeholder="KI anweisen, z. B. „Gutschein über 10 % anbieten“"
              className="h-7 w-full rounded-md bg-muted/60 pl-7 pr-8 text-[13px] outline-none placeholder:text-muted-foreground focus:bg-muted"
            />
            {instruction && (
              <button type="submit" className="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded bg-foreground text-background">
                <ArrowUp className="size-3" />
              </button>
            )}
          </form>
          {QUICK.map((q) => (
            <button
              key={q}
              disabled={generating}
              onClick={() => generate(q)}
              className="h-7 shrink-0 rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {q}
            </button>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" disabled={generating} onClick={() => generate()} aria-label="Neu generieren">
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Komplett neu generieren (G)</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="flex items-center gap-2 border-t px-3 py-2">
        <p className="hidden text-xs text-muted-foreground xl:block">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd> senden · <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>↵</Kbd> senden & erledigen
        </p>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={!body.trim() || sending || generating} onClick={() => send(true)}>
            <Check /> Senden & erledigen
          </Button>
          <Button size="sm" disabled={!body.trim() || sending || generating} onClick={() => send(false)}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />} Senden
          </Button>
        </div>
      </div>
    </div>
  );
});
