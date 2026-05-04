# GIG Weekly — Setup & Deployment

## What you need
- GitHub account (push this repo here)
- Vercel account (free tier is fine) — connect your GitHub repo

---

## Step 1 — Push to GitHub

```bash
cd "GIG VIDEO/New live artefact"
git init
git add .
git commit -m "Initial GIG Weekly build"
# Create a new repo on GitHub called e.g. gig-weekly, then:
git remote add origin https://github.com/YOUR_USERNAME/gig-weekly.git
git push -u origin main
```

---

## Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import your `gig-weekly` repo
2. Framework preset: **Next.js** (auto-detected)
3. Click Deploy — first deploy will work immediately (live RSS fetch, no archive yet)

---

## Step 3 — Enable Archive (Vercel KV)

This step adds persistent weekly storage. Skip it initially — the site works without it,
but archive won't be available.

1. In your Vercel project dashboard → **Storage** → **Create Database** → **KV**
2. Name it `gig-weekly-kv`, accept defaults
3. Click **Connect to Project** → your project
4. Vercel automatically adds these env vars:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
5. Redeploy the project (Settings → Deployments → Redeploy latest)

---

## Step 4 — Set a Refresh Secret (optional but recommended)

In Vercel project → Settings → Environment Variables, add:

```
REFRESH_SECRET = any-long-random-string-you-choose
```

This lets you manually trigger a refresh at any time by visiting:
```
https://your-site.vercel.app/api/refresh?secret=your-secret
```

---

## Step 5 — Cron Job (automatic Monday 7am UTC)

This is already configured in `vercel.json`. Vercel reads it automatically on deploy.
Vercel Cron is available on the free **Hobby** plan (max 2 crons).

To verify it's active: Vercel dashboard → your project → **Cron Jobs** tab.

---

## Fonts

The site uses **Barlow** (Google Fonts, loaded automatically) as a web-safe substitute.

To use the official **Motiva Sans** (Adobe Fonts):
1. Get your Adobe Fonts project embed code
2. Add `<link rel="stylesheet" href="https://use.typekit.net/YOUR_ID.css" />` to `app/layout.tsx`
3. Update `tailwind.config.js` fontFamily to `'motiva-sans'` as the first entry

---

## Manual Article Refresh

Any time you want to refresh outside of Monday, hit:
```
/api/refresh?secret=YOUR_REFRESH_SECRET
```

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in KV vars if you have them, or leave blank (live fetch still works)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
