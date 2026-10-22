import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import type { Mailbox } from "@/lib/types";

export async function getMailboxPassword(mailboxId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_secrets")
    .select("password_enc")
    .eq("mailbox_id", mailboxId)
    .single();
  if (error || !data) throw new Error("Zugangsdaten für Postfach fehlen");
  return decrypt(data.password_enc);
}

export async function getShopifyToken(storeId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("store_secrets").select("shopify_token_enc").eq("store_id", storeId).maybeSingle();
  return data?.shopify_token_enc ? decrypt(data.shopify_token_enc) : null;
}

export type MailboxWithPassword = Mailbox & { password: string };
