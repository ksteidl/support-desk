# Support Desk – KI-Kundensupport für Shopify

Eine Inbox für alle deine Shopify-Stores. Support-E-Mails werden per IMAP abgerufen, nach
Bestellnummer, E-Mail, Name und Tracking-Nummer gescannt, mit den echten Shopify-Daten
abgeglichen und von Claude als Antwortentwurf vorbereitet. Du prüfst, passt an und sendest.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Auth, Postgres, Realtime) · shadcn/ui · Tailwind v4 · Claude API

## Funktionen

- **Account** – Registrierung/Login über Supabase Auth
- **Mehrere Stores** – je Store: Shopify Admin API Token, Farbe, Sprache, Tonalität/Richtlinien, Signatur
- **Support-Postfächer** – beliebig viele pro Store (IMAP + SMTP, Presets für Gmail, IONOS, Strato, Zoho …); Verbindung wird vor dem Speichern getestet
- **Scanner** – erkennt Bestellnummern (`#1045`, „Bestellnummer 1045“, „Order no. SHOP-5521“ …), E-Mails, Namen aus Absender/Grußformel, Tracking-Nummern. Zitierter Verlauf wird ignoriert.
- **Shopify-Lookup** – Bestellungen nach Nummer, E-Mail (und notfalls Name), Kundenprofil mit Umsatz, Tags, Notizen, Tracking & Lieferadresse
- **KI-Entwürfe** – werden automatisch nach dem Abruf neuer Mails im Hintergrund erzeugt; markiert Fälle, die menschliche Prüfung brauchen (z. B. Erstattung)
- **Aufgaben-Inbox** – Offen / Wartend / Erledigt, Store-Filter, Suche (Name, E-Mail, Bestellnr.), Live-Updates
- **Überarbeiten** – frei editieren oder per Anweisung („Kürzer“, „Gutschein über 10 % anbieten“) neu generieren lassen; Autosave
- **Versand** – als echte Antwort im Thread (In-Reply-To/References), Kopie im „Gesendet“-Ordner
- **Kundenverlauf** – kompletter E-Mail-Verlauf eines Kunden über alle Tickets und Stores
- **Tastatur** – `J`/`K` navigieren, `/` suchen, `R` antworten, `G` neu generieren, `E` erledigt, `⌘↵` senden, `⌘⇧↵` senden & erledigen
- Hell/Dunkel-Modus, responsive

## Einrichtung

### 1. Supabase

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. SQL aus `supabase/migrations/0001_init.sql` im SQL-Editor ausführen (oder `npx supabase db push`).
3. Unter **Authentication → URL Configuration** die Site-URL setzen und `https://deine-domain/auth/callback` als Redirect-URL eintragen.

### 2. Umgebungsvariablen

```bash
cp .env.example .env.local
openssl rand -base64 32   # → ENCRYPTION_KEY
```

| Variable | Wofür |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Project Settings → API |
| `SUPABASE_SECRET_KEY` | Secret Key – nur Server (Sync & verschlüsselte Zugangsdaten) |
| `ANTHROPIC_API_KEY` | Claude API Key |
| `ENCRYPTION_KEY` | AES-256-Schlüssel für Mail-Passwörter & Shopify-Tokens |
| `CRON_SECRET` | Schützt `/api/cron/sync` |
| `SHOPIFY_API_VERSION` | Standard `2026-07` |

> ⚠️ `ENCRYPTION_KEY` nicht mehr ändern, sobald Zugangsdaten gespeichert sind – sonst müssen alle Passwörter/Tokens neu eingegeben werden.

### 3. Starten

```bash
npm install
npm run dev
```

### 4. In der App

1. Registrieren → **Stores & Postfächer** → Store hinzufügen.
   Shopify-Token: Shopify Admin → Einstellungen → Apps → App entwickeln → Admin-API-Scopes
   `read_orders`, `read_customers`, `read_fulfillments` → Token (`shpat_…`) kopieren.
2. Support-Postfach zum Store verbinden. Gmail benötigt ein App-Passwort.
   Hinweis: Microsoft 365/Outlook erlaubt kein IMAP/SMTP mit Passwort mehr (nur OAuth) – dafür wäre eine OAuth-Anbindung nötig.
3. Beim ersten Abruf werden die E-Mails der letzten 14 Tage importiert.

## Mail-Abruf

- Die Inbox ruft beim Öffnen und alle 2 Minuten neue Mails ab (Button ↻ für sofort).
- Für Abruf ohne geöffnete App: `vercel.json` enthält einen Cron alle 5 Minuten auf `/api/cron/sync`
  (Vercel sendet automatisch `Authorization: Bearer $CRON_SECRET`). Minütliche Crons erfordern Vercel Pro –
  alternativ jeden externen Cron-Dienst verwenden.
- Automatische Mails (Newsletter, Bounces, `no-reply`, Auto-Reply) werden übersprungen.

## Sicherheit

- Alle Tabellen haben Row Level Security – jeder Benutzer sieht nur seine eigenen Daten.
- Shopify-Tokens und Mail-Passwörter liegen AES-256-GCM-verschlüsselt in `store_secrets`/`mailbox_secrets`,
  Tabellen **ohne** RLS-Policies: nur der Server mit Secret Key kann sie lesen.

## Projektstruktur

```
src/
  app/
    (auth)/login, signup        Login & Registrierung
    (app)/inbox                 Aufgabenliste + Ticket-Ansicht
    (app)/customers             Kunden & kompletter Verlauf
    (app)/settings              Stores & Postfächer
    actions/                    Server Actions (auth, stores, tickets)
    api/sync, api/cron/sync     Mail-Abruf
  lib/
    ai.ts                       Scan → Shopify → Claude → Entwurf
    extract.ts                  Bestellnr./E-Mail/Name/Tracking-Scanner
    shopify.ts                  Shopify Admin GraphQL
    mail/                       IMAP-Abruf, Threading, SMTP-Versand
    supabase/                   Clients (Browser, Server, Admin, Proxy)
  proxy.ts                      Session-Refresh & Auth-Redirects
supabase/migrations/            Datenbankschema
```

## KI-Modell

Entwürfe werden mit `claude-opus-5-5` erzeugt (strukturierte Ausgabe: Antwort, Zusammenfassung, Kategorie,
Prüfhinweis). Server-seitige Fallbacks (`fallbacks: "default"`) sind aktiv, damit eine vom Sicherheitsfilter
abgelehnte Anfrage automatisch auf einem Ausweichmodell beantwortet wird. Modell & Prompt: `src/lib/ai.ts`.
