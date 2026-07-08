# 🗺️ Treasure Hunt

A real-world, reward-based exploration web app. Players explore the real world to discover and claim treasures with real rewards.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend/Auth/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Maps**: Leaflet + OpenStreetMap/CARTO tiles (free, no API key needed)
- **State**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod

## Getting Started

### 1. Clone & Install

```bash
cd treasure-hunt
npm install
```

### 2. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` — from your Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase project settings

No maps API key is needed — the map runs on free Leaflet + OpenStreetMap/CARTO tiles.

### 3. Set up the database

Go to your Supabase project → **SQL Editor** → paste and run, in order:
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_storage_policies.sql
supabase/migrations/003_backfill_profiles.sql
```

Once you've signed up at least one account, optionally run
`supabase/migrations/004_seed_bangalore_treasures.sql` to populate the map
with sample treasures at famous Bangalore landmarks for testing.

### 4. Enable Google OAuth (optional)

In Supabase → **Authentication → Providers → Google**, enable it and add your Google OAuth credentials.

Add `http://localhost:3000/auth/callback` to the allowed redirect URLs (and your production
`https://yourdomain.com/auth/callback` / `.../auth/confirm` once deployed).

### 5. Create storage bucket

In Supabase → **Storage**, create a bucket named `treasure-images` with public access.

### 6. Email confirmation setup

This app verifies signup emails via Supabase's `token_hash` flow (works across
devices/browsers, unlike the default PKCE `code` flow). In Supabase →
**Authentication → Email Templates → Confirm signup**, set the link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/map
```

### 7. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
treasure-hunt/
├── app/
│   ├── (app)/               # Authenticated app routes
│   │   ├── map/             # 🗺️ Home — interactive map
│   │   ├── create/          # ➕ Create treasure
│   │   ├── treasure/[id]/   # 💎 Treasure detail + claim
│   │   ├── profile/         # 👤 Player profile + XP
│   │   └── leaderboard/     # 🏆 Global rankings
│   ├── login/               # 🔐 Auth page
│   └── auth/callback/       # OAuth redirect handler
├── components/
│   ├── map/                 # Map + marker components
│   ├── treasure/            # Create form + detail/claim UI
│   ├── profile/             # Profile view
│   ├── leaderboard/         # Leaderboard UI
│   └── nav/                 # Bottom navigation
├── lib/
│   ├── supabase/            # Supabase client (browser + server)
│   ├── types/               # TypeScript types
│   └── utils/               # Helpers (distance, XP, colors)
└── supabase/
    └── migrations/          # SQL schema
```

## Features (Phase 1)

- ✅ Google + email authentication
- ✅ Interactive dark-mode map with treasure markers
- ✅ Filter by difficulty, search by name
- ✅ Nearby treasure cards with live distance
- ✅ 2-step treasure creation with map pin drop
- ✅ Real-time GPS distance tracking on treasure page
- ✅ GPS-verified claim system with radius enforcement
- ✅ +50 XP awarded automatically on claim (via DB trigger)
- ✅ Explorer levels (Beginner → World Explorer)
- ✅ Player profile with activity, badges, created treasures
- ✅ Global leaderboard with podium view
- ✅ Image upload for treasures (Supabase Storage)

## Difficulty Levels

| Level | Color | XP Reward |
|-------|-------|-----------|
| Easy | 🟢 Green | +50 XP |
| Medium | 🟡 Amber | +50 XP |
| Hard | 🟠 Orange | +50 XP |
| Legendary | 🟣 Purple | +50 XP |

## Explorer Levels

| Level | XP Required |
|-------|-------------|
| Beginner | 0 |
| Scout | 100 |
| Explorer | 300 |
| Adventurer | 700 |
| Master Explorer | 1,500 |
| Legend | 3,000 |
| World Explorer | 6,000 |
