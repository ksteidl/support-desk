import { CircleAlert, CircleCheck, Mail, Pencil, Plus, ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiEnabled } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { StoreDot } from "@/components/store-dot";
import { StoreDialog } from "@/components/settings/store-dialog";
import { MailboxDialog } from "@/components/settings/mailbox-dialog";
import { DeleteButton } from "@/components/settings/delete-button";
import { relative } from "@/lib/format";
import type { Mailbox, Store } from "@/lib/types";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { welcome } = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: stores }, { data: mailboxes }] = await Promise.all([
    supabase.from("stores").select("*").order("created_at").returns<Store[]>(),
    supabase.from("mailboxes").select("*").order("created_at").returns<Mailbox[]>(),
  ]);
  const ids = (stores ?? []).map((s) => s.id);
  const { data: secrets } = ids.length
    ? await createAdminClient().from("store_secrets").select("store_id, shopify_token_enc").in("store_id", ids)
    : { data: [] };
  const connected = new Set((secrets ?? []).filter((s) => s.shopify_token_enc).map((s) => s.store_id));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Stores & Postfächer</h1>
            <p className="mt-1 text-muted-foreground">Verbinde deine Shopify-Stores und die zugehörigen Support-Adressen.</p>
          </div>
          <StoreDialog
            trigger={
              <Button size="sm">
                <Plus /> Store
              </Button>
            }
          />
        </div>

        {welcome && !stores?.length && (
          <div className="mb-6 rounded-xl border bg-card p-5">
            <p className="font-medium">Willkommen! In zwei Schritten startklar:</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Shopify-Store mit Admin-API-Token hinzufügen</li>
              <li>Support-Postfach (IMAP/SMTP) zum Store verbinden</li>
            </ol>
          </div>
        )}
        {!aiEnabled() && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
            <CircleAlert className="size-4" /> <span><code>ANTHROPIC_API_KEY</code> ist nicht gesetzt – KI-Entwürfe sind deaktiviert.</span>
          </div>
        )}

        {!stores?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
            <ShoppingBag className="size-6 text-muted-foreground" />
            <p className="text-muted-foreground">Noch kein Store verbunden.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stores.map((store) => {
              const boxes = (mailboxes ?? []).filter((m) => m.store_id === store.id);
              return (
                <section key={store.id} className="overflow-hidden rounded-xl border bg-card">
                  <header className="flex items-center gap-3 p-4">
                    <StoreDot color={store.color} className="size-2.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{store.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{store.shop_domain}</p>
                    </div>
                    {connected.has(store.id) ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CircleCheck className="size-3.5" /> Shopify verbunden
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <CircleAlert className="size-3.5" /> Kein API-Token
                      </span>
                    )}
                    <StoreDialog
                      store={store}
                      hasToken={connected.has(store.id)}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Bearbeiten">
                          <Pencil />
                        </Button>
                      }
                    />
                    <DeleteButton kind="store" id={store.id} name={store.name} />
                  </header>
                  <div className="border-t bg-muted/30">
                    {boxes.map((mb) => (
                      <div key={mb.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                        <Mail className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{mb.email}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {mb.last_error ? (
                              <span className="text-destructive">{mb.last_error}</span>
                            ) : mb.last_synced_at ? (
                              `Zuletzt abgerufen ${relative(mb.last_synced_at)}`
                            ) : (
                              "Noch nicht abgerufen"
                            )}
                          </p>
                        </div>
                        <MailboxDialog
                          storeId={store.id}
                          mailbox={mb}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Bearbeiten">
                              <Pencil />
                            </Button>
                          }
                        />
                        <DeleteButton kind="mailbox" id={mb.id} name={mb.email} />
                      </div>
                    ))}
                    <MailboxDialog
                      storeId={store.id}
                      trigger={
                        <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground">
                          <Plus className="size-4" /> Support-Postfach verbinden
                        </button>
                      }
                    />
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
