-- Shopify Support Desk – Schema
-- Alle Tabellen sind per Row Level Security auf den eingeloggten Benutzer beschränkt.
-- Zugangsdaten (Shopify-Token, Mail-Passwörter) liegen verschlüsselt in *_secrets-Tabellen
-- ohne Policies: nur der Server (Secret Key) kann sie lesen.

create extension if not exists pgcrypto;

-- ───────────────────────── Stores ─────────────────────────
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  shop_domain text not null,
  color text not null default '#6366f1',
  language text not null default 'de',
  brand_voice text not null default '',
  signature text not null default '',
  created_at timestamptz not null default now()
);
create index stores_user_idx on public.stores (user_id);

create table public.store_secrets (
  store_id uuid primary key references public.stores (id) on delete cascade,
  shopify_token_enc text
);

-- ───────────────────────── Postfächer ─────────────────────────
create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  username text not null,
  imap_host text not null,
  imap_port int not null default 993,
  imap_secure boolean not null default true,
  smtp_host text not null,
  smtp_port int not null default 465,
  smtp_secure boolean not null default true,
  last_uid bigint not null default 0,
  uid_validity bigint,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);
create index mailboxes_store_idx on public.mailboxes (store_id);

create table public.mailbox_secrets (
  mailbox_id uuid primary key references public.mailboxes (id) on delete cascade,
  password_enc text not null
);

-- ───────────────────────── Tickets (Aufgaben) ─────────────────────────
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  customer_email text not null,
  customer_name text,
  subject text not null default '',
  snippet text not null default '',
  status text not null default 'open' check (status in ('open', 'waiting', 'closed')),
  unread boolean not null default true,
  has_draft boolean not null default false,
  order_numbers text[] not null default '{}',
  category text,
  summary text,
  shopify_context jsonb,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index tickets_user_status_idx on public.tickets (user_id, status, last_message_at desc);
create index tickets_customer_idx on public.tickets (user_id, lower(customer_email));

-- ───────────────────────── Nachrichten ─────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_id text,
  in_reply_to text,
  reference_ids text[] not null default '{}',
  from_email text not null,
  from_name text,
  to_emails text[] not null default '{}',
  subject text not null default '',
  body_text text not null default '',
  body_html text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (mailbox_id, message_id)
);
create index messages_ticket_idx on public.messages (ticket_id, sent_at);
create index messages_message_id_idx on public.messages (mailbox_id, message_id);

-- ───────────────────────── KI-Entwürfe ─────────────────────────
create table public.drafts (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  model text,
  reasoning text,
  needs_attention boolean not null default false,
  generated_at timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.stores enable row level security;
alter table public.store_secrets enable row level security;
alter table public.mailboxes enable row level security;
alter table public.mailbox_secrets enable row level security;
alter table public.tickets enable row level security;
alter table public.messages enable row level security;
alter table public.drafts enable row level security;

create policy "own stores" on public.stores
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own mailboxes" on public.mailboxes
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own tickets" on public.tickets
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own messages" on public.messages
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own drafts" on public.drafts
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- store_secrets / mailbox_secrets: absichtlich KEINE Policies.

-- Live-Updates für die Inbox
alter publication supabase_realtime add table public.tickets;
