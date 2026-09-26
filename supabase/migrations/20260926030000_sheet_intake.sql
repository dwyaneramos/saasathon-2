-- Sheet intake: a drawing-set sheet is a document row that has been stored but not yet
-- processed. `sheet_type` is the tag the estimator picked at upload time (the human label);
-- `doc_type` stays the AI classifier's opinion, so a disagreement between the two is
-- visible rather than silently overwritten.

alter table public.documents add column if not exists sheet_type text;
alter table public.dococuments add column if not exists size_bytes bigint;

-- Widen the status check to include the pre-processing 'intake' state. The constraint is
-- named here so the drop is explicit rather than relying on the generated name.
alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents
  add constraint documents_status_check
  check (status in ('intake', 'pending', 'extracted', 'skipped_noise', 'error'));

create index if not exists documents_project_sheet_type_idx
  on public.documents (project_id, sheet_type)
  where sheet_type is not null;
