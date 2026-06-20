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

drop policy if exists "Users can view their own search runs" on public.job_search_runs;
create policy "Users can view their own search runs" on public.job_search_runs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own search runs" on public.job_search_runs;
create policy "Users can insert their own search runs" on public.job_search_runs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own search runs" on public.job_search_runs;
create policy "Users can update their own search runs" on public.job_search_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can view their own search jobs" on public.job_search_jobs;
create policy "Users can view their own search jobs" on public.job_search_jobs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own search jobs" on public.job_search_jobs;
create policy "Users can insert their own search jobs" on public.job_search_jobs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own search jobs" on public.job_search_jobs;
create policy "Users can update their own search jobs" on public.job_search_jobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
