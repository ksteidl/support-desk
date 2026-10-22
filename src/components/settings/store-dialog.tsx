"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveStore } from "@/app/actions/stores";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Store } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#71717a"];

export function StoreDialog({ store, hasToken, trigger }: { store?: Store; hasToken?: boolean; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [color, setColor] = useState(store?.color ?? COLORS[0]);
  const [language, setLanguage] = useState(store?.language ?? "de");

  function submit(form: FormData) {
    start(async () => {
      const res = await saveStore(store?.id ?? null, {
        name: String(form.get("name")),
        shop_domain: String(form.get("shop_domain")),
        shopify_token: String(form.get("shopify_token") ?? "") || undefined,
        brand_voice: String(form.get("brand_voice") ?? ""),
        signature: String(form.get("signature") ?? ""),
        color,
        language,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Gespeichert");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{store ? "Store bearbeiten" : "Shopify-Store hinzufügen"}</DialogTitle>
          <DialogDescription>Die KI nutzt die Shopify-Daten, um Bestellungen, Status und Tracking in Antworten einzubauen.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={store?.name} placeholder="Mein Shop" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop_domain">Shop-Domain</Label>
              <Input id="shop_domain" name="shop_domain" defaultValue={store?.shop_domain} placeholder="mein-shop.myshopify.com" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopify_token">Admin API Access Token</Label>
            <Input
              id="shopify_token"
              name="shopify_token"
              type="password"
              autoComplete="off"
              placeholder={hasToken ? "•••••••• (gespeichert – leer lassen, um beizubehalten)" : "shpat_…"}
            />
            <p className="text-xs text-muted-foreground">
              Shopify Admin → Einstellungen → Apps → App entwickeln. Benötigte Scopes: <code>read_orders</code>, <code>read_customers</code>,{" "}
              <code>read_fulfillments</code>.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", color === c && "ring-2 ring-ring")}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Standardsprache</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">Englisch</SelectItem>
                  <SelectItem value="fr">Französisch</SelectItem>
                  <SelectItem value="nl">Niederländisch</SelectItem>
                  <SelectItem value="it">Italienisch</SelectItem>
                  <SelectItem value="es">Spanisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand_voice">Tonalität & Richtlinien für die KI</Label>
            <Textarea
              id="brand_voice"
              name="brand_voice"
              rows={5}
              defaultValue={store?.brand_voice}
              placeholder={"Wir duzen unsere Kunden.\nRetouren: 30 Tage kostenlos über retoure.meinshop.de\nVersand: 2–4 Werktage mit DHL\nBei Defekten: Foto anfordern, dann Ersatz."}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signature">Signatur</Label>
            <Textarea id="signature" name="signature" rows={3} defaultValue={store?.signature} placeholder={"Liebe Grüße\nLisa vom Mein-Shop-Team"} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
