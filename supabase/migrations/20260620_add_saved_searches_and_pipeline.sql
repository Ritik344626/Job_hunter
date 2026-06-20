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

drop trigger if exists trg_saved_searches_updated_at on public.saved_searches;
create trigger trg_saved_searches_updated_at before update on public.saved_searches for each row execute function public.set_updated_at();
drop trigger if exists trg_job_pipeline_items_updated_at on public.job_pipeline_items;
create trigger trg_job_pipeline_items_updated_at before update on public.job_pipeline_items for each row execute function public.set_updated_at();

alter table public.saved_searches enable row level security;
alter table public.job_pipeline_items enable row level security;

drop policy if exists "Users can view their own saved searches" on public.saved_searches;
create policy "Users can view their own saved searches" on public.saved_searches for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own saved searches" on public.saved_searches;
create policy "Users can insert their own saved searches" on public.saved_searches for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own saved searches" on public.saved_searches;
create policy "Users can update their own saved searches" on public.saved_searches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own saved searches" on public.saved_searches;
create policy "Users can delete their own saved searches" on public.saved_searches for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own pipeline items" on public.job_pipeline_items;
create policy "Users can view their own pipeline items" on public.job_pipeline_items for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own pipeline items" on public.job_pipeline_items;
create policy "Users can insert their own pipeline items" on public.job_pipeline_items for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own pipeline items" on public.job_pipeline_items;
create policy "Users can update their own pipeline items" on public.job_pipeline_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
