-- One cloud-backed drawing per project. RLS keeps each user's drawings scoped to
-- projects they own, while the JSON payload preserves the existing canvas format.
create table public.project_drawings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  drawing jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.project_drawings enable row level security;

grant select, insert, update on public.project_drawings to authenticated;

create policy "Owners can read their project's drawing"
  on public.project_drawings for select to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_drawings.project_id
      and projects.owner_id = (select auth.uid())
    )
  );

create policy "Owners can insert their project's drawing"
  on public.project_drawings for insert to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_drawings.project_id
      and projects.owner_id = (select auth.uid())
    )
  );

create policy "Owners can update their project's drawing"
  on public.project_drawings for update to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_drawings.project_id
      and projects.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_drawings.project_id
      and projects.owner_id = (select auth.uid())
    )
  );
