"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { normalizeShopDomain, testShopifyConnection } from "@/lib/shopify";
import { testImap } from "@/lib/mail/imap";
import { testSmtp } from "@/lib/mail/smtp";
import type { Mailbox } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const StoreSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt"),
  shop_domain: z.string().trim().min(1, "Shop-Domain fehlt"),
  color: z.string().default("#6366f1"),
  language: z.string().default("de"),
  brand_voice: z.string().default(""),
  signature: z.string().default(""),
  shopify_token: z.string().trim().optional(),
});

export async function saveStore(storeId: string | null, input: z.input<typeof StoreSchema>): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = StoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { shopify_token, ...fields } = parsed.data;
  fields.shop_domain = normalizeShopDomain(fields.shop_domain);

  if (shopify_token) {
    try {
      await testShopifyConnection(fields.shop_domain, shopify_token);
    } catch (err) {
      return { ok: false, error: `Shopify-Verbindung fehlgeschlagen: ${message(err)}` };
    }
  }

  const { data, error } = storeId
    ? await supabase.from("stores").update(fields).eq("id", storeId).select("id").single()
    : await supabase.from("stores").insert({ ...fields, user_id: userId }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Speichern fehlgeschlagen" };

  if (shopify_token) {
    const { error: secretError } = await createAdminClient()
      .from("store_secrets")
      .upsert({ store_id: data.id, shopify_token_enc: encrypt(shopify_token) });
    if (secretError) return { ok: false, error: secretError.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: shopify_token ? "Store gespeichert & Shopify verbunden" : "Store gespeichert" };
}

export async function deleteStore(storeId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

const MailboxSchema = z.object({
  store_id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
  display_name: z.string().trim().default(""),
  username: z.string().trim().min(1, "Benutzername fehlt"),
  password: z.string().optional(),
  imap_host: z.string().trim().min(1, "IMAP-Server fehlt"),
  imap_port: z.coerce.number().int().default(993),
  imap_secure: z.boolean().default(true),
  smtp_host: z.string().trim().min(1, "SMTP-Server fehlt"),
  smtp_port: z.coerce.number().int().default(465),
  smtp_secure: z.boolean().default(true),
});

export async function saveMailbox(mailboxId: string | null, input: z.input<typeof MailboxSchema>): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = MailboxSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { password, ...fields } = parsed.data;

  if (!mailboxId && !password) return { ok: false, error: "Passwort fehlt" };

  // Verbindung testen, bevor gespeichert wird
  if (password) {
    const probe = { ...(fields as unknown as Mailbox), password, last_uid: 0, uid_validity: null };
    try {
      await testImap(probe);
    } catch (err) {
      return { ok: false, error: `IMAP-Verbindung fehlgeschlagen: ${message(err)}` };
    }
    try {
      await testSmtp(probe);
    } catch (err) {
      return { ok: false, error: `SMTP-Verbindung fehlgeschlagen: ${message(err)}` };
    }
  }

  const { data, error } = mailboxId
    ? await supabase.from("mailboxes").update(fields).eq("id", mailboxId).select("id").single()
    : await supabase.from("mailboxes").insert({ ...fields, user_id: userId }).select("id").single();
  if (error || !data) {
    return { ok: false, error: error?.code === "23505" ? "Dieses Postfach existiert bereits" : (error?.message ?? "Fehler") };
  }
  if (password) {
    const { error: secretError } = await createAdminClient()
      .from("mailbox_secrets")
      .upsert({ mailbox_id: data.id, password_enc: encrypt(password) });
    if (secretError) return { ok: false, error: secretError.message };
  }
  revalidatePath("/settings");
  return { ok: true, message: "Postfach verbunden" };
}

export async function deleteMailbox(mailboxId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("mailboxes").delete().eq("id", mailboxId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
