-- One editable cable schedule per project, stored as a JSON array of rows
-- (shape: server/src/routes/cable-schedule.ts CableRow).
create table public.cable_schedules (
  project_id uuid primary key references public.projects (id) on delete cascade,
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cable_schedules enable row level security;

grant select, insert, update on public.cable_schedules to authenticated;

-- Defense-in-depth, matching documents/wiring_plans: the server's service-role client
-- does the reads/writes today, but a direct client call stays scoped to the owner.
create policy "Owners can read their project's cable schedule"
  on public.cable_schedules for select to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = cable_schedules.project_id
      and projects.owner_id = (select auth.uid())
    )
  );

create policy "Owners can insert their project's cable schedule"
  on public.cable_schedules for insert to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = cable_schedules.project_id
      and projects.owner_id = (select auth.uid())
    )
  );

create policy "Owners can update their project's cable schedule"
  on public.cable_schedules for update to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = cable_schedules.project_id
      and projects.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = cable_schedules.project_id
      and projects.owner_id = (select auth.uid())
    )
  );
