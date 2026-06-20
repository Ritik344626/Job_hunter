create extension if not exists pgcrypto;

create table if not exists public.user_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key_encrypted text,
  apify_api_token_encrypted text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_user_integrations_updated_at on public.user_integrations;
create trigger trg_user_integrations_updated_at
before update on public.user_integrations
for each row
execute function public.set_updated_at();

alter table public.user_integrations enable row level security;

create policy "Users can view their own integrations"
on public.user_integrations
for select
using (auth.uid() = user_id);

create policy "Users can insert their own integrations"
on public.user_integrations
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own integrations"
on public.user_integrations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.job_search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  query text not null,
  location text,
  remote_only boolean not null default false,
  max_items integer not null check (max_items between 1 and 100),
  actor_id text not null,
  actor_input jsonb,
  apify_run_id text unique,
  dataset_id text,
  jobs_found integer not null default 0,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.job_search_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.job_search_runs(id) on delete cascade,
  external_id text not null,
  title text not null,
  company text not null,
  location text,
  url text,
  description text,
  date_posted text,
  employment_type text,
  is_remote boolean not null default false,
  salary text,
  source text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (run_id, external_id)
);

create index if not exists job_search_runs_user_created_at_idx
on public.job_search_runs (user_id, created_at desc);

create index if not exists job_search_jobs_run_id_idx
on public.job_search_jobs (run_id);

drop trigger if exists trg_job_search_runs_updated_at on public.job_search_runs;
create trigger trg_job_search_runs_updated_at
before update on public.job_search_runs
for each row
execute function public.set_updated_at();

alter table public.job_search_runs enable row level security;
alter table public.job_search_jobs enable row level security;

create policy "Users can view their own search runs"
on public.job_search_runs
for select
using (auth.uid() = user_id);

create policy "Users can insert their own search runs"
on public.job_search_runs
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own search runs"
on public.job_search_runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view their own search jobs"
on public.job_search_jobs
for select
using (auth.uid() = user_id);

create policy "Users can insert their own search jobs"
on public.job_search_jobs
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own search jobs"
on public.job_search_jobs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.job_pipeline_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  title text not null,
  company text not null,
  location text,
  url text,
  status text not null default 'saved' check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
  notes text,
  follow_up_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, external_id)
);

create index if not exists saved_searches_user_updated_at_idx on public.saved_searches (user_id, updated_at desc);
create index if not exists job_pipeline_items_user_updated_at_idx on public.job_pipeline_items (user_id, updated_at desc);

create trigger trg_saved_searches_updated_at before update on public.saved_searches for each row execute function public.set_updated_at();
create trigger trg_job_pipeline_items_updated_at before update on public.job_pipeline_items for each row execute function public.set_updated_at();

alter table public.saved_searches enable row level security;
alter table public.job_pipeline_items enable row level security;

create policy "Users can view their own saved searches" on public.saved_searches for select using (auth.uid() = user_id);
create policy "Users can insert their own saved searches" on public.saved_searches for insert with check (auth.uid() = user_id);
create policy "Users can update their own saved searches" on public.saved_searches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own saved searches" on public.saved_searches for delete using (auth.uid() = user_id);
create policy "Users can view their own pipeline items" on public.job_pipeline_items for select using (auth.uid() = user_id);
create policy "Users can insert their own pipeline items" on public.job_pipeline_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own pipeline items" on public.job_pipeline_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
