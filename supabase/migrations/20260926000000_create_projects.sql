create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  status text not null default 'Not started',
  priority text not null default 'Medium',
  start_date date,
  due_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

grant select, insert, update, delete on public.projects to authenticated;

create policy "Users can read their projects"
  on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Users can create their projects"
  on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Users can update their projects"
  on public.projects for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Users can delete their projects"
  on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));
