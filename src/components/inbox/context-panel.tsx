import Link from "next/link";
import { ExternalLink, History, Package, ScanSearch, Sparkles, Truck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { money, shortDate } from "@/lib/format";
import { CATEGORY_LABELS, type ShopifyContext, type ShopifyOrder, type Store } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIN: Record<string, string> = {
  PAID: "Bezahlt",
  PENDING: "Ausstehend",
  REFUNDED: "Erstattet",
  PARTIALLY_REFUNDED: "Teilw. erstattet",
  AUTHORIZED: "Autorisiert",
  VOIDED: "Storniert",
  PARTIALLY_PAID: "Teilw. bezahlt",
  EXPIRED: "Abgelaufen",
};
const FUL: Record<string, string> = {
  FULFILLED: "Versendet",
  UNFULFILLED: "Nicht versendet",
  PARTIALLY_FULFILLED: "Teilw. versendet",
  IN_PROGRESS: "In Bearbeitung",
  ON_HOLD: "Angehalten",
  SCHEDULED: "Geplant",
  RESTOCKED: "Zurückgelagert",
  PENDING_FULFILLMENT: "Ausstehend",
  OPEN: "Offen",
};

function Section({ icon: Icon, title, children, action }: { icon: typeof User; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="flex-1">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function OrderCard({ order, highlighted }: { order: ShopifyOrder; highlighted: boolean }) {
  const fulfilled = order.fulfillmentStatus === "FULFILLED";
  return (
    <div className={cn("rounded-lg border bg-card p-3", highlighted && "ring-2 ring-ai/40")}>
      <div className="flex items-center gap-2">
        <a href={order.adminUrl} target="_blank" rel="noreferrer" className="font-mono font-medium hover:underline">
          {order.name}
        </a>
        <span className="text-xs text-muted-foreground">{shortDate(order.createdAt)}</span>
        <span className="ml-auto font-medium tabular-nums">{money(order.total, order.currency)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {order.cancelledAt && <Badge variant="destructive">Storniert</Badge>}
        {order.financialStatus && (
          <Badge variant="secondary" className="font-normal">
            {FIN[order.financialStatus] ?? order.financialStatus}
          </Badge>
        )}
        {order.fulfillmentStatus && (
          <Badge variant="secondary" className={cn("font-normal", fulfilled && "bg-success/15 text-success")}>
            {FUL[order.fulfillmentStatus] ?? order.fulfillmentStatus}
          </Badge>
        )}
      </div>
      <ul className="mt-2.5 space-y-0.5 text-[13px] text-muted-foreground">
        {order.items.slice(0, 4).map((i, idx) => (
          <li key={idx} className="truncate">
            {i.quantity}× {i.title}
            {i.variant && <span className="opacity-70"> · {i.variant}</span>}
          </li>
        ))}
        {order.items.length > 4 && <li>+ {order.items.length - 4} weitere</li>}
      </ul>
      {order.tracking.map((t, idx) => (
        <a
          key={idx}
          href={t.url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-[13px] hover:bg-accent"
        >
          <Truck className="size-3.5 shrink-0" />
          <span className="truncate">
            {t.company} <span className="font-mono">{t.number}</span>
          </span>
          {t.url && <ExternalLink className="ml-auto size-3 shrink-0" />}
        </a>
      ))}
      {order.shippingAddress && <p className="mt-2 text-xs text-muted-foreground">{order.shippingAddress}</p>}
    </div>
  );
}

export function ContextPanel({
  context,
  store,
  customerEmail,
  customerName,
  summary,
  category,
  previousTickets,
}: {
  context: ShopifyContext | null;
  store: Store;
  customerEmail: string;
  customerName: string | null;
  summary: string | null;
  category: string | null;
  previousTickets: number;
}) {
  const wanted = new Set(context?.extracted.orderNumbers ?? []);
  const customer = context?.customer;
  const ex = context?.extracted;

  return (
    <div className="space-y-6 p-4">
      {summary && (
        <Section icon={Sparkles} title="KI-Zusammenfassung">
          <p className="leading-relaxed">{summary}</p>
          {category && <Badge variant="outline">{CATEGORY_LABELS[category] ?? category}</Badge>}
        </Section>
      )}

      <Section
        icon={User}
        title="Kunde"
        action={
          customer && (
            <a
              href={`https://${store.shop_domain}/admin/customers/${customer.id.split("/").pop()}`}
              target="_blank"
              rel="noreferrer"
              className="normal-case tracking-normal hover:text-foreground"
            >
              Shopify <ExternalLink className="inline size-3" />
            </a>
          )
        }
      >
        <div className="rounded-lg border bg-card p-3">
          <p className="font-medium">{customer?.name || customerName || customerEmail}</p>
          <p className="truncate text-muted-foreground">{customerEmail}</p>
          {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
          {customer && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <div>
                <p className="text-muted-foreground">Bestellungen</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums">{customer.numberOfOrders}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Umsatz</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums">
                  {customer.amountSpent ? money(...(customer.amountSpent.split(" ") as [string, string])) : "–"}
                </p>
              </div>
            </div>
          )}
          {customer?.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {customer.tags.map((t) => (
                <Badge key={t} variant="outline" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}
          {customer?.note && <p className="mt-2 rounded bg-muted p-2 text-xs">{customer.note}</p>}
        </div>
        <Link
          href={`/customers/${encodeURIComponent(customerEmail)}`}
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <History className="size-3.5" /> Kompletter Verlauf
          {previousTickets > 0 && <span className="ml-auto tabular-nums">{previousTickets + 1} Anfragen</span>}
        </Link>
      </Section>

      {ex && (ex.orderNumbers.length > 0 || ex.trackingNumbers.length > 0 || ex.emails.length > 0) && (
        <Section icon={ScanSearch} title="Erkannt in der E-Mail">
          <div className="flex flex-wrap gap-1.5">
            {ex.orderNumbers.map((n) => (
              <Badge key={n} variant="secondary" className="font-mono font-normal">
                #{n}
              </Badge>
            ))}
            {ex.trackingNumbers.map((n) => (
              <Badge key={n} variant="secondary" className="font-mono font-normal">
                <Truck /> {n}
              </Badge>
            ))}
            {ex.emails
              .filter((e) => e !== customerEmail.toLowerCase())
              .map((e) => (
                <Badge key={e} variant="secondary" className="font-normal">
                  {e}
                </Badge>
              ))}
          </div>
        </Section>
      )}

      <Section icon={Package} title="Bestellungen">
        {!context ? (
          <p className="text-muted-foreground">Wird beim Generieren des Entwurfs geladen.</p>
        ) : context.error ? (
          <p className="text-destructive">{context.error}</p>
        ) : context.orders.length === 0 ? (
          <p className="text-muted-foreground">Keine Bestellungen gefunden.</p>
        ) : (
          <div className="space-y-2">
            {context.orders.slice(0, 5).map((o) => (
              <OrderCard key={o.id} order={o} highlighted={wanted.has(o.name.replace(/^#/, "").toUpperCase())} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
