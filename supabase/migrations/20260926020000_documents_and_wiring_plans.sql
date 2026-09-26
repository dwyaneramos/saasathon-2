create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  source_file text not null,
  doc_type text,
  status text not null default 'pending' check (status in ('pending', 'extracted', 'skipped_noise', 'error')),
  needs_review_count integer not null default 0,
  error text,
  extraction jsonb,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

grant select, insert on public.documents to authenticated;

-- Defense-in-depth: today only the server's service-role client reads/writes these
-- tables (it bypasses RLS), but these policies keep a direct client read/write
-- correctly scoped to the requesting user's own projects if one is ever added.
create policy "Owners can read their project's documents"
  on public.documents for select to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = documents.project_id
      and projects.owner_id = (select auth.uid())
    )
  );

create policy "Owners can insert their project's documents"
  on public.documents for insert to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = documents.project_id
      and projects.owner_id = (select auth.uid())
    )
  );

create table public.wiring_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  generated_at timestamptz not null default now(),
  items jsonb not null
);

alter table public.wiring_plans enable row level security;

grant select, insert on public.wiring_plans to authenticated;

create policy "Owners can read their project's wiring plans"
  on public.wiring_plans for select to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = wiring_plans.project_id
      and projects.owner_id = (select auth.uid())
    )
  );

create policy "Owners can insert their project's wiring plans"
  on public.wiring_plans for insert to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = wiring_plans.project_id
      and projects.owner_id = (select auth.uid())
    )
  );
