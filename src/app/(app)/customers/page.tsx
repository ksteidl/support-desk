import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { StoreDot } from "@/components/store-dot";
import { CustomerSearch } from "@/components/customer-search";
import { initials, shortDate } from "@/lib/format";

interface Row {
  customer_email: string;
  customer_name: string | null;
  store_id: string;
  status: string;
  last_message_at: string;
}

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim().replace(/[,()%]/g, " ") : "";
  const { supabase } = await requireUser();

  let query = supabase
    .from("tickets")
    .select("customer_email, customer_name, store_id, status, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(2000);
  if (term) query = query.or(`customer_email.ilike.%${term}%,customer_name.ilike.%${term}%`);
  const [{ data }, { data: stores }] = await Promise.all([
    query.returns<Row[]>(),
    supabase.from("stores").select("id, name, color"),
  ]);
  const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));

  const customers = new Map<string, { email: string; name: string | null; stores: Set<string>; tickets: number; open: number; last: string }>();
  for (const r of data ?? []) {
    const key = r.customer_email.toLowerCase();
    const c = customers.get(key) ?? { email: r.customer_email, name: r.customer_name, stores: new Set(), tickets: 0, open: 0, last: r.last_message_at };
    c.name ??= r.customer_name;
    c.stores.add(r.store_id);
    c.tickets++;
    if (r.status === "open") c.open++;
    customers.set(key, c);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Kunden</h1>
            <p className="mt-1 text-muted-foreground">{customers.size} Kunden mit Support-Verlauf</p>
          </div>
          <CustomerSearch initial={term} />
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {customers.size === 0 ? (
            <p className="p-8 text-center text-muted-foreground">Keine Kunden gefunden.</p>
          ) : (
            <ul className="divide-y">
              {[...customers.values()].map((c) => (
                <li key={c.email}>
                  <Link href={`/customers/${encodeURIComponent(c.email)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {initials(c.name, c.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name || c.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </div>
                    <div className="hidden items-center gap-1.5 sm:flex">
                      {[...c.stores].map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <StoreDot color={storeMap.get(id)?.color} className="size-1.5" /> {storeMap.get(id)?.name}
                        </span>
                      ))}
                    </div>
                    <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                      {c.tickets} {c.tickets === 1 ? "Anfrage" : "Anfragen"}
                    </span>
                    {c.open > 0 ? (
                      <span className="w-14 text-right text-xs font-medium text-ai">{c.open} offen</span>
                    ) : (
                      <span className="w-14 text-right text-xs text-muted-foreground">{shortDate(c.last)}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
