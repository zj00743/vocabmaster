# Deploy VocabMaster (mobile + desktop)

The app is a responsive Next.js site — one URL works on phone and laptop.

## 1. GitHub

Push this repo to GitHub (create a new empty repo on github.com, then):

```bash
cd vocab-app
git remote add origin https://github.com/YOUR_USERNAME/vocab-app.git
git push -u origin main
```

## 2. Vercel (recommended)

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New Project** → import your `vocab-app` repository.
3. **Root Directory**: leave as repo root (or set to `vocab-app` if the repo root is the parent folder).
4. **Environment Variables** (Project → Settings → Environment Variables). Copy from your local `.env.local`:

   | Name | Required |
   |------|----------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
   | `OPENAI_API_KEY` | Optional (AI generate/enrich) |
   | `MERRIAM_WEBSTER_COLLEGIATE_API_KEY` | Optional |
   | `MERRIAM_WEBSTER_LEARNERS_API_KEY` | Optional |
   | `MERRIAM_WEBSTER_THESAURUS_API_KEY` | Optional |

5. Deploy. Vercel gives you a URL like `https://vocab-app-xxx.vercel.app`.

### Supabase after deploy

In Supabase → **Authentication** → **URL Configuration**, add your Vercel URL to **Site URL** (if you add auth later).

For the anon key + public URL, the app works without extra CORS setup for browser reads/writes you already use.

## 3. Use on phone

- Open the Vercel URL in Safari/Chrome.
- **Share → Add to Home Screen** (iOS) or **Install app** (Android) for an app-like icon.

## Alternative: run on your LAN only

```bash
npm run build && npm run start -- -H 0.0.0.0
```

Visit `http://YOUR_LAPTOP_IP:3000` on the same Wi‑Fi (not public internet).
