-- The mock frontend data (client/src/data/projects.ts) carried owner/type/address
-- fields the original projects table never had. Add them so the real table can
-- fully replace the mock data without dropping fields the UI already displays.
alter table public.projects
  add column owner text not null default '',
  add column type text not null default 'Residential' check (type in ('Residential', 'Commercial')),
  add column address text not null default '';
