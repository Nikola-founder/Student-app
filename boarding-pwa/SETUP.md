# Project Architecture Setup — Boarding Student PWA

Stack: **Next.js (App Router) + Tailwind CSS + Supabase + Groq API + Vercel**
This is a *deployed web app* from step one — no local-only assumptions. You'll develop against a real Supabase project and a real Vercel deployment.

---

## Step 1 — Create the Supabase project

1. Go to https://supabase.com → New Project.
2. Choose a region close to your host country (lower latency for students).
3. Once created, go to **SQL Editor** → paste the contents of `schema.sql` (provided) → Run.
4. Go to **Authentication → Providers** → enable **Email** (and optionally Google/Apple OAuth for easier student sign-in).
5. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (server-only, never expose to the browser)

## Step 2 — Get a Groq API key

1. Go to https://console.groq.com → API Keys → Create Key.
2. Copy the key — you'll only see it once.

## Step 3 — Scaffold the Next.js app

```bash
npx create-next-app@latest boarding-pwa \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd boarding-pwa
```

## Step 4 — Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr groq-sdk recharts date-fns date-fns-tz lucide-react
npm install -D @types/node
```

- `@supabase/ssr` — cookie-based auth helpers for Next.js App Router (server + client).
- `groq-sdk` — official Groq SDK (OpenAI-compatible chat completions, very low latency).
- `recharts` — pie chart / progress visualizations for the Finance module.
- `date-fns` + `date-fns-tz` — dual timezone math for the Calendar module.

## Step 5 — Environment variables

Create `.env.local` (and add the same keys in **Vercel → Project → Settings → Environment Variables** for production):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-only, no NEXT_PUBLIC_ prefix
GROQ_API_KEY=your_groq_key                        # server-only
```

> `NEXT_PUBLIC_*` vars are shipped to the browser. Never prefix the service role key or the Groq key with `NEXT_PUBLIC_` — they must stay server-side.

## Step 6 — Supabase client helpers

`src/lib/supabase/client.ts` (browser client, for Client Components):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`src/lib/supabase/server.ts` (server client, for Server Components/Route Handlers):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

## Step 7 — Make it an installable PWA

1. `npm install next-pwa` (or hand-roll a manifest + service worker — `next-pwa` is fastest).
2. Add `public/manifest.json`:
```json
{
  "name": "Boarding Life",
  "short_name": "BoardingLife",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
3. Reference it in `src/app/layout.tsx`:
```tsx
export const metadata = {
  manifest: '/manifest.json',
  themeColor: '#4F46E5',
}
```
4. Wrap `next.config.js` with `next-pwa` to auto-generate the service worker (offline caching of the app shell). This is what makes "open it like an app" work identically on iPhone Safari, Android Chrome, and desktop.

## Step 8 — Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel          # first deploy, links the project
vercel --prod   # production deploy
```

Or connect the GitHub repo directly in the Vercel dashboard for auto-deploy on every push. Add the four env vars from Step 5 in **Vercel → Settings → Environment Variables** (Production + Preview).

Once deployed, any student can open the Vercel URL on any phone/tablet/laptop browser and tap **"Add to Home Screen"** — no app store needed.

## Suggested folder structure

```
src/
  app/
    (auth)/login/page.tsx
    (dashboard)/
      calendar/page.tsx
      journal/page.tsx
      finance/page.tsx
      contacts/page.tsx
    api/
      journal/reflect/route.ts        <- Part 1 code
      journal/weekly-summary/route.ts
  components/
    calendar/
    journal/
    finance/
    contacts/ContactsDirectory.tsx    <- Part 2 code
  lib/
    supabase/{client,server}.ts
    groq.ts
    timezone.ts
  types/
    database.ts   (generate with: npx supabase gen types typescript)
```
