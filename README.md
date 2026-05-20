# VocabMaster - Personal Vocabulary Learning App

A lightweight, AI-powered vocabulary learning web app with spaced repetition, built for personal use.

## Features

- **CoCA 60,000 Database** - Import and study from the Corpus of Contemporary American English
- **FSRS Spaced Repetition** - Scientifically-proven memory scheduling algorithm
- **AI-Generated Cards** - OpenAI-powered vocabulary card generation with mnemonics
- **Mobile-First Design** - Optimized for phone use, works great on desktop too
- **Flashcard Review** - Smooth flip animations with tap/swipe interaction
- **Word Search** - Search CoCA database or generate new cards with AI
- **Categories** - Browse words by topic (academic, business, science, etc.)
- **Progress Tracking** - Dashboard with stats, streaks, and retention rates

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui
- **Database**: Supabase (PostgreSQL, no auth)
- **AI**: OpenAI GPT-4o-mini
- **Algorithm**: FSRS (Free Spaced Repetition Scheduler)

## Getting Started

### 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Copy your project URL and anon key from Settings > API

### 2. Configure Environment

Copy `.env.local` and fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-openai-key
```

### 3. Install & Run

```bash
cd vocab-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

### 4. Import CoCA Data (Optional)

#### Option A: Via Settings page
1. Download the CoCA 60,000 word list as CSV
2. Go to Settings in the app
3. Click "Import CoCA Data" and select your CSV file

#### Option B: Via command line
```bash
npx tsx scripts/import-coca.ts path/to/coca.csv
```

## Usage

1. **Dashboard** - See your daily stats and start reviewing
2. **Review** - Flip flashcards and rate your recall (Again/Hard/Good/Easy)
3. **Search** - Find words in the database or generate new cards with AI
4. **My Words** - Browse and manage your saved vocabulary
5. **Categories** - Explore words by topic
6. **Settings** - Adjust daily targets and preferences

## Spaced Repetition

The app uses the FSRS algorithm, which tracks:
- **Difficulty** - How hard the word is for you (1-10)
- **Stability** - How well you remember it (determines interval)
- **Next Review** - When you should see the card again

Rating guide:
- **Again (1)** - Completely forgot
- **Hard (2)** - Remembered with difficulty
- **Good (3)** - Remembered correctly
- **Easy (4)** - Remembered instantly
