# ShipIQ — Intelligent Shipping from Iraq

A full-stack shipping management platform for international e-commerce orders, built with Next.js 14 and Supabase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Hosting | Vercel |
| Scraping | Oxylabs Web Scraper API |
| Images | RapidAPI (Amazon product images) |
| WhatsApp | Ultramsg / Twilio |
| Accounting | Wave / Zoho (optional) |

---

## Features

### Customer
- Sign up / sign in, AR/EN language toggle
- Submit orders with URL, description, photo, category, quantity
- Auto-calculates shipping estimate via Oxylabs scraper
- Track orders through a 9-step pipeline with progress timeline
- Manage wallet balance and view transaction history
- Delivery scheduling (pickup or home delivery with map pin)
- Wishlist, loyalty tier badge, in-app notifications
- Chat with admin via order notes

### Admin
- View and filter all customer orders (by status, date, country, customer)
- Bulk status updates
- Calculate shipping price and charge customer balance
- Wave / Zoho accounting sync per order
- Customer management (suspend, adjust balance, add internal notes)
- Delivery request management
- Analytics dashboard
- WhatsApp message templates and notification config
- Tier settings management
- Agent account creation

### Agent
- Dedicated dashboard for assigned country (USA / Turkey / UAE / China)
- View confirmed→delivered orders for their country

---

## Quick Start

### 1. Clone & install
```bash
git clone <repo>
cd shipiq
npm install
```

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill in the values:
```bash
cp .env.example .env.local
```

Required:
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `OXYLABS_USERNAME` | Oxylabs Web Scraper API username |
| `OXYLABS_PASSWORD` | Oxylabs Web Scraper API password |
| `RAPIDAPI_KEY` | RapidAPI key for product image lookup |

Optional (WhatsApp, accounting):
| Variable | Description |
|----------|-------------|
| `ULTRAMSG_TOKEN` | Ultramsg API token |
| `ULTRAMSG_INSTANCE` | Ultramsg instance ID |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp number |
| `WAVE_API_KEY` | Wave accounting API key |
| `ZOHO_CLIENT_ID` | Zoho Books OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Zoho Books OAuth client secret |

### 3. Set up the database
1. Open your Supabase project → **SQL Editor → New Query**
2. Paste the contents of `supabase-schema.sql`
3. Click **Run**

Then make your account admin:
```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy to Vercel
```bash
npm install -g vercel
vercel
```

Add all env vars in Vercel → Settings → Environment Variables, then redeploy.

---

## Order Status Flow

```
pending → calculated → confirmed → ordered → warehouse → transit → arrived → out_for_delivery → delivered
                                                                                  ↑ rejected (from pending/calculated)
```

---

## Project Structure

```
app/
  api/           # Next.js API routes (scrape, whatsapp, orders, accounting…)
  auth/          # Auth page (sign in / sign up)
  dashboard/     # Main dashboard (admin + customer + agent)
    components/  # Page-level components
lib/
  api.ts         # All Supabase & external API calls
  types.ts       # TypeScript interfaces
  constants.ts   # Status config, categories, shipping rates
  api_schema.ts  # API endpoint docs (for Flutter app reference)
  hooks/         # React hooks (useBalance, useNotifications, useLanguage)
  rate-limit.ts  # In-memory per-IP rate limiter for API routes
```

---

## Flutter Integration

All business logic is abstracted in `lib/api.ts`. API routes are documented in `lib/api_schema.ts`. Flutter services should:
1. Mirror the API endpoints in `lib/services/`
2. Use the Supabase Dart SDK for direct table access where appropriate
3. Pass the Supabase access token in request bodies where required
