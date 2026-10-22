export type TicketStatus = "open" | "waiting" | "closed";

export interface Store {
  id: string;
  name: string;
  shop_domain: string;
  color: string;
  language: string;
  brand_voice: string;
  signature: string;
  created_at: string;
}

export interface Mailbox {
  id: string;
  store_id: string;
  email: string;
  display_name: string;
  username: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  last_uid: number;
  uid_validity: number | null;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface Ticket {
  id: string;
  user_id: string;
  store_id: string;
  mailbox_id: string;
  customer_email: string;
  customer_name: string | null;
  subject: string;
  snippet: string;
  status: TicketStatus;
  unread: boolean;
  has_draft: boolean;
  order_numbers: string[];
  category: string | null;
  summary: string | null;
  shopify_context: ShopifyContext | null;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  ticket_id: string;
  mailbox_id: string;
  direction: "inbound" | "outbound";
  message_id: string | null;
  in_reply_to: string | null;
  reference_ids: string[];
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  subject: string;
  body_text: string;
  body_html: string | null;
  sent_at: string;
}

export interface Draft {
  ticket_id: string;
  body: string;
  model: string | null;
  reasoning: string | null;
  needs_attention: boolean;
  generated_at: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  email: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  total: string;
  currency: string;
  adminUrl: string;
  items: { title: string; quantity: number; variant: string | null }[];
  tracking: { company: string | null; number: string | null; url: string | null }[];
  shippingAddress: string | null;
  customerName: string | null;
}

export interface ShopifyCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  numberOfOrders: number;
  amountSpent: string | null;
  note: string | null;
  tags: string[];
}

export interface ShopifyContext {
  fetchedAt: string;
  extracted: ExtractedEntities;
  customer: ShopifyCustomer | null;
  orders: ShopifyOrder[];
  error?: string;
}

export interface ExtractedEntities {
  orderNumbers: string[];
  emails: string[];
  names: string[];
  phones: string[];
  trackingNumbers: string[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  shipping: "Versand",
  return: "Retoure",
  refund: "Erstattung",
  exchange: "Umtausch",
  product: "Produktfrage",
  order_change: "Bestelländerung",
  payment: "Zahlung",
  complaint: "Reklamation",
  other: "Sonstiges",
};
