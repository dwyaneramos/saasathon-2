-- Storage bucket for uploaded job documents (server/src/routes/project-documents.ts).
-- supabase/config.toml only creates it for a local `supabase start`; this makes sure hosted
-- projects get it too. Private: the server uploads with the service-role key, and job
-- documents shouldn't be reachable by public URL. 26214400 bytes = 25 MiB, matching config.toml.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-documents', 'project-documents', false, 26214400)
on conflict (id) do nothing;
