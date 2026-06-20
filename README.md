# Job Hunter

Starter project for a job hunting platform with:

- Next.js full-stack app (App Router)
- Supabase Auth + PostgreSQL
- Per-user Gemini API key + Apify API token storage
- LinkedIn scraper pipeline (filter selections become LinkedIn search URLs, then Apify runs the actor)

## 1) Environment Setup

Copy environment template:

```bash
cp .env.example .env.local
```

Fill these values in `.env.local`:

- `NEXT_PUBLIC_APP_URL` (usually `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `APIFY_LINKEDIN_ACTOR_ID` (default: `curious_coder/linkedin-jobs-scraper`)
- `GEMINI_MODEL` (default: `gemini-2.5-flash`)
- `INTEGRATION_ENCRYPTION_KEY` (generate with `openssl rand -base64 32`)

## 2) Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL editor, run [supabase/schema.sql](supabase/schema.sql). For an existing project, run [supabase/migrations/20260620_encrypt_user_integrations.sql](supabase/migrations/20260620_encrypt_user_integrations.sql), then [supabase/migrations/20260620_add_job_search_pipeline.sql](supabase/migrations/20260620_add_job_search_pipeline.sql), and finally [supabase/migrations/20260620_add_saved_searches_and_pipeline.sql](supabase/migrations/20260620_add_saved_searches_and_pipeline.sql). Users must reconnect their integrations once after the encryption migration.
3. In Authentication settings:
	- Enable Email provider.
	- Optionally disable email confirmation for local testing.

## 3) Run App

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4) Current Flow

1. User signs up/signs in with email/password.
2. User tests and saves Gemini and Apify credentials in dashboard. Credentials are encrypted with AES-256-GCM before they are stored in Supabase.
3. `/api/jobs/searches` creates a persistent search run, builds an actor-compatible URL payload from the selected filters, then starts Apify without waiting for completion.
4. The dashboard polls the single actor run and normalizes its dataset into stable job records when Apify finishes.

## API Routes

- `GET /api/integrations` returns whether keys are configured.
- `POST /api/integrations/test` verifies an unsaved Gemini or Apify credential.
- `POST /api/integrations` validates and encrypts user keys before storage.
- `POST /api/jobs/searches` starts an asynchronous Gemini + Apify search run.
- `GET /api/jobs/searches/:runId` returns run progress and finalized normalized jobs.
- `GET` / `POST /api/saved-searches` lists and saves filter presets.
- `GET` / `POST /api/pipeline` lists and tracks jobs in the application pipeline.
- `PATCH /api/pipeline/:itemId` updates a job's pipeline status.
- `GET /auth/callback` handles Supabase OAuth callback exchange.

## Security Note

Integration keys are encrypted by the Next.js server with AES-256-GCM before entering the database. Keep `INTEGRATION_ENCRYPTION_KEY` out of Supabase and version control; rotate user credentials if that key is ever exposed.
