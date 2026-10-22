import "server-only";
import type { ExtractedEntities, ShopifyContext, ShopifyCustomer, ShopifyOrder } from "./types";

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

export function normalizeShopDomain(input: string) {
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return d.includes(".") ? d : `${d}.myshopify.com`;
}

async function gql<T>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`Shopify: ${json.errors.map((e) => e.message).join(", ")}`);
  return json.data as T;
}

const ORDER_FIELDS = /* GraphQL */ `
  id
  name
  createdAt
  email
  cancelledAt
  displayFinancialStatus
  displayFulfillmentStatus
  totalPriceSet { shopMoney { amount currencyCode } }
  customer { displayName }
  shippingAddress { name address1 address2 zip city countryCodeV2 }
  lineItems(first: 20) { nodes { title quantity variantTitle } }
  fulfillments(first: 5) { trackingInfo(first: 3) { company number url } }
`;

interface RawOrder {
  id: string;
  name: string;
  createdAt: string;
  email: string | null;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  customer: { displayName: string } | null;
  shippingAddress: {
    name: string | null;
    address1: string | null;
    address2: string | null;
    zip: string | null;
    city: string | null;
    countryCodeV2: string | null;
  } | null;
  lineItems: { nodes: { title: string; quantity: number; variantTitle: string | null }[] };
  fulfillments: { trackingInfo: { company: string | null; number: string | null; url: string | null }[] }[];
}

function mapOrder(shop: string, o: RawOrder): ShopifyOrder {
  const a = o.shippingAddress;
  return {
    id: o.id,
    name: o.name,
    createdAt: o.createdAt,
    email: o.email,
    cancelledAt: o.cancelledAt,
    financialStatus: o.displayFinancialStatus,
    fulfillmentStatus: o.displayFulfillmentStatus,
    total: o.totalPriceSet.shopMoney.amount,
    currency: o.totalPriceSet.shopMoney.currencyCode,
    adminUrl: `https://${shop}/admin/orders/${o.id.split("/").pop()}`,
    items: o.lineItems.nodes.map((i) => ({ title: i.title, quantity: i.quantity, variant: i.variantTitle })),
    tracking: o.fulfillments.flatMap((f) => f.trackingInfo),
    shippingAddress: a
      ? [a.name, a.address1, a.address2, [a.zip, a.city].filter(Boolean).join(" "), a.countryCodeV2]
          .filter(Boolean)
          .join(", ")
      : null,
    customerName: o.customer?.displayName ?? null,
  };
}

async function searchOrders(shop: string, token: string, query: string, first = 5) {
  const data = await gql<{ orders: { nodes: RawOrder[] } }>(
    shop,
    token,
    `query($q: String!, $first: Int!) { orders(first: $first, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { ${ORDER_FIELDS} } } }`,
    { q: query, first },
  );
  return data.orders.nodes.map((o) => mapOrder(shop, o));
}

async function findCustomer(shop: string, token: string, email: string): Promise<ShopifyCustomer | null> {
  const data = await gql<{
    customers: {
      nodes: {
        id: string;
        displayName: string;
        defaultEmailAddress: { emailAddress: string } | null;
        defaultPhoneNumber: { phoneNumber: string } | null;
        numberOfOrders: string;
        amountSpent: { amount: string; currencyCode: string } | null;
        note: string | null;
        tags: string[];
      }[];
    };
  }>(
    shop,
    token,
    `query($q: String!) { customers(first: 1, query: $q) { nodes {
      id displayName note tags numberOfOrders
      defaultEmailAddress { emailAddress }
      defaultPhoneNumber { phoneNumber }
      amountSpent { amount currencyCode }
    } } }`,
    { q: `email:"${email.replace(/"/g, "")}"` },
  );
  const c = data.customers.nodes[0];
  if (!c) return null;
  return {
    id: c.id,
    name: c.displayName,
    email: c.defaultEmailAddress?.emailAddress ?? null,
    phone: c.defaultPhoneNumber?.phoneNumber ?? null,
    numberOfOrders: Number(c.numberOfOrders),
    amountSpent: c.amountSpent ? `${c.amountSpent.amount} ${c.amountSpent.currencyCode}` : null,
    note: c.note,
    tags: c.tags,
  };
}

/**
 * Sucht anhand der gescannten Daten (Bestellnummern, E-Mails, Name) passende
 * Bestellungen und den Kunden im Shopify-Store.
 */
export async function lookupShopifyContext(params: {
  shop: string;
  token: string;
  customerEmail: string;
  extracted: ExtractedEntities;
}): Promise<ShopifyContext> {
  const { shop, token, customerEmail, extracted } = params;
  const ctx: ShopifyContext = { fetchedAt: new Date().toISOString(), extracted, customer: null, orders: [] };
  const byId = new Map<string, ShopifyOrder>();
  const add = (orders: ShopifyOrder[]) => orders.forEach((o) => byId.set(o.id, o));

  try {
    const emails = [...new Set([customerEmail.toLowerCase(), ...extracted.emails])].slice(0, 3);
    const tasks: Promise<unknown>[] = [
      ...extracted.orderNumbers.slice(0, 3).map((n) => searchOrders(shop, token, `name:${n} OR name:#${n}`, 2).then(add)),
      ...emails.map((e) => searchOrders(shop, token, `email:"${e.replace(/"/g, "")}"`, 5).then(add)),
      findCustomer(shop, token, customerEmail).then((c) => (ctx.customer = c)),
    ];
    await Promise.all(tasks);

    // Kein Treffer? Letzter Versuch über den Namen.
    if (byId.size === 0 && extracted.names[0]) {
      add(await searchOrders(shop, token, `customer_name:"${extracted.names[0].replace(/"/g, "")}"`, 3));
    }
  } catch (err) {
    ctx.error = err instanceof Error ? err.message : String(err);
  }

  const wanted = new Set(extracted.orderNumbers);
  ctx.orders = [...byId.values()].sort((a, b) => {
    const aw = wanted.has(a.name.replace(/^#/, "").toUpperCase()) ? 1 : 0;
    const bw = wanted.has(b.name.replace(/^#/, "").toUpperCase()) ? 1 : 0;
    return bw - aw || b.createdAt.localeCompare(a.createdAt);
  });
  return ctx;
}

export async function testShopifyConnection(shop: string, token: string) {
  const data = await gql<{ shop: { name: string } }>(shop, token, `{ shop { name } }`);
  return data.shop.name;
}
