"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveMailbox } from "@/app/actions/stores";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Mailbox } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRESETS: Record<string, { label: string; imap: string; smtp: string; smtpPort: number; hint?: string }> = {
  gmail: { label: "Gmail / Workspace", imap: "imap.gmail.com", smtp: "smtp.gmail.com", smtpPort: 465, hint: "Benötigt ein App-Passwort (Google-Konto → Sicherheit → App-Passwörter)." },
  ionos: { label: "IONOS", imap: "imap.ionos.de", smtp: "smtp.ionos.de", smtpPort: 465 },
  strato: { label: "Strato", imap: "imap.strato.de", smtp: "smtp.strato.de", smtpPort: 465 },
  allinkl: { label: "All-Inkl", imap: "", smtp: "", smtpPort: 465, hint: "Server: w0XXXXXX.kasserver.com (siehe KAS)." },
  zoho: { label: "Zoho", imap: "imap.zoho.eu", smtp: "smtp.zoho.eu", smtpPort: 465 },
  custom: { label: "Andere", imap: "", smtp: "", smtpPort: 465 },
};

export function MailboxDialog({ storeId, mailbox, trigger }: { storeId: string; mailbox?: Mailbox; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState(mailbox ? "custom" : "gmail");
  const [imapHost, setImapHost] = useState(mailbox?.imap_host ?? PRESETS.gmail.imap);
  const [smtpHost, setSmtpHost] = useState(mailbox?.smtp_host ?? PRESETS.gmail.smtp);
  const [smtpPort, setSmtpPort] = useState(mailbox?.smtp_port ?? 465);
  const [imapPort, setImapPort] = useState(mailbox?.imap_port ?? 993);
  const [email, setEmail] = useState(mailbox?.email ?? "");
  const [username, setUsername] = useState(mailbox?.username ?? "");
  const [imapSecure, setImapSecure] = useState(mailbox?.imap_secure ?? true);
  const [smtpSecure, setSmtpSecure] = useState(mailbox?.smtp_secure ?? true);

  function choose(key: string) {
    setPreset(key);
    const p = PRESETS[key];
    setImapHost(p.imap);
    setSmtpHost(p.smtp);
    setSmtpPort(p.smtpPort);
    setImapPort(993);
    setImapSecure(true);
    setSmtpSecure(p.smtpPort === 465);
  }

  function submit(form: FormData) {
    start(async () => {
      const res = await saveMailbox(mailbox?.id ?? null, {
        store_id: storeId,
        email,
        display_name: String(form.get("display_name") ?? ""),
        username: username || email,
        password: String(form.get("password") ?? "") || undefined,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_secure: imapSecure,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: smtpSecure,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Gespeichert", { description: "Neue E-Mails der letzten 14 Tage werden jetzt importiert." });
      setOpen(false);
      router.refresh();
      if (!mailbox) fetch("/api/sync", { method: "POST" });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mailbox ? "Postfach bearbeiten" : "Support-Postfach verbinden"}</DialogTitle>
          <DialogDescription>E-Mails werden per IMAP abgerufen und Antworten per SMTP von dieser Adresse gesendet.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          {!mailbox && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => choose(key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent",
                    preset === key && "border-foreground bg-accent font-medium",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {PRESETS[preset].hint && <p className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">{PRESETS[preset].hint}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@shop.de" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Absendername</Label>
              <Input id="display_name" name="display_name" defaultValue={mailbox?.display_name} placeholder="Mein Shop Support" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={email || "meist = E-Mail"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!mailbox}
                placeholder={mailbox ? "leer lassen = unverändert" : ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_80px_auto] items-end gap-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label>IMAP-Server</Label>
              <Input required value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input type="number" value={imapPort} onChange={(e) => setImapPort(Number(e.target.value))} />
            </div>
            <label className="flex h-9 items-center gap-2 text-xs">
              <Switch checked={imapSecure} onCheckedChange={setImapSecure} /> SSL
            </label>
            <div className="space-y-2">
              <Label>SMTP-Server</Label>
              <Input required value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} />
            </div>
            <label className="flex h-9 items-center gap-2 text-xs">
              <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} /> SSL
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Die Verbindung wird vor dem Speichern getestet. Passwörter werden verschlüsselt gespeichert.</p>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Verbindung wird getestet…" : "Verbinden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
