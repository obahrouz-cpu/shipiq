# ShipIQ — Setup Guide

## ✅ Step 1: Supabase Database Setup

1. Go to your Supabase project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-schema.sql`
5. Click **Run**

You should see "Success" — this creates all your tables.

---

## ✅ Step 2: Make Yourself Admin

After you sign up on the site for the first time, run this in Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
```

Replace `YOUR_EMAIL_HERE` with the email you signed up with.

---

## ✅ Step 3: Deploy to Vercel

1. Go to [github.com](https://github.com) and create a free account if you don't have one
2. Create a **new repository** called `shipiq`
3. Upload all these project files to it

**OR** use Vercel CLI (easier):
1. Install Node.js from [nodejs.org](https://nodejs.org)
2. Open terminal in this folder
3. Run:
```bash
npm install -g vercel
vercel
```
4. Follow the prompts — it will give you a live URL!

---

## ✅ Step 4: Add Environment Variables in Vercel

In your Vercel project dashboard:
1. Go to **Settings → Environment Variables**
2. Add these two:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pzlckjasayitxcblvkjg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ENc_XRoxeWwS2Y5oeCy_XA_qmDfK_EX` |

3. Click **Save** then **Redeploy**

---

## Features

### Customer
- Sign up / Sign in
- Submit orders with URL, description, photo, notes, urgency flag
- Track order status (Pending → Calculated → Confirmed → Shipped)
- View account balance and transaction history
- Confirm orders when shipping price is set

### Admin
- View all customer orders, filtered by status
- Calculate shipping price for each order
- Reject orders with a reason
- Mark orders as shipped
- View all customers and their balances
- Top up customer balances manually

---

## Tech Stack
- **Frontend**: Next.js 14 (React)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **File Storage**: Supabase Storage
- **Hosting**: Vercel
