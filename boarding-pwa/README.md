# Boarding Life — Boarding Student PWA

Cross-device PWA for international boarding students: Calendar, Wellness &amp; AI Journal, Finance, and a Dorm/Social Directory. Built with Next.js (App Router), Tailwind, Supabase, and Groq — deployed on Vercel.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in your real Supabase + Groq keys
```

1. Create a Supabase project at supabase.com.
2. Run `supabase/schema.sql` in the Supabase SQL Editor (sets up all tables, RLS policies, and the boarding_houses seed data).
3. Enable Email auth under Authentication → Providers.
4. Get a free API key at console.groq.com.
5. Fill in `.env.local` with your Project URL, anon key, service role key, and Groq key.

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign up, and a profile row is created automatically (see the `handle_new_user()` trigger in the schema).

## Deploy

```bash
npm install -g vercel
vercel --prod
```

Add the same 4 env vars in **Vercel → Project → Settings → Environment Variables**. Once deployed, open the URL on any phone and choose **"Add to Home Screen"** — no app store needed.

## What's wired up vs. what's stubbed

**Fully working:**
- Auth (email/password sign-up, sign-in, session refresh via middleware)
- Calendar: Day/Week/Month/Agenda, CRUD, category colors, dual timezone display
- Wellness Journal: mood logger, tags, thought dump, AI daily reflection (Groq), weekly trend summary
- Finance: expense logging, category pie chart, monthly budget progress bar
- Dorm/Social Directory: contact cards, search, filter by House/Grade/Language
- Route-level protection (unauthenticated users are redirected to `/login`)

**Stubbed — needs a decision before real use:**
- **FX conversion** (`amount_in_home_currency`) — currently only set when you log directly in home currency. Wire in a live rates API (e.g. exchangerate-api.com) for real dual-currency totals.
- **`home_currency_code` / `host_currency_code`** aren't columns on `profiles` yet — add them and read real ISO codes into the Finance page instead of the hardcoded `"USD"` placeholders.
- **`needs_support_resources`** flag from the AI reflection is returned but not surfaced anywhere beyond a static banner — point it at your school's actual counselor contact/crisis resource before this goes live with real students.
- **Adding/editing contacts and boarding houses** — the directory currently only reads; an add/edit contact form and admin management of `boarding_houses` still need building.
- **PWA icons** — `public/manifest.json` references `/icons/icon-192.png` and `/icons/icon-512.png`; drop real PNGs in `public/icons/`.
