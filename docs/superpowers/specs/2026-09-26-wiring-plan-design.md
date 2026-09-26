# AI Wiring Plan (per-project document pipeline + materials plan)

Status: approved (conversational design), pending spec review
Date: 2026-09-26

## Purpose

Electricians uploading a project's paperwork (site plans, wiring/electrical
layout plans, switchboard schedules, legacy quotes/invoices, cable
schedules) should get back a consolidated "what wiring to get" materials
list, with each line item marked **low / medium / high confidence** so it's
obvious which parts need more information before ordering.

This builds on the existing document pipeline in `server/src/pipeline/`
(classify → extract → validate), which already turns uploaded files into
structured `ExtractionDocument`s with per-field provenance and numeric
confidence. That pipeline is unchanged. This spec adds:

1. Persistence: documents and their extraction results live in Supabase,
   scoped to a project, instead of vanishing after each ad-hoc run.
2. A new pipeline stage, `plan.ts`, that synthesizes one project's
   `ExtractionDocument`s into a materials list.
3. UI to upload documents against a project and view the resulting plan.

## Explicit non-goals

- **No engineering inference.** The plan stage never computes or estimates
  cable sizing, load calculations, derated ampacities, or pricing that
  isn't already stated in a source document. If no document states a
  spec, the item says so (low confidence, `needs_info`) rather than
  guessing. This mirrors the existing `extract.ts` instructions verbatim.
- **No real authentication.** A single seeded demo Supabase user stands in
  for login. No sign-in screen, no session UI, no multi-user support.
- **No changes to `classify.ts` / `extract.ts` / `validate.ts`.** They're
  reused as-is.
- **`PipelineTestPage` / `/pipeline` route is untouched** — it remains a
  standalone ad-hoc tool outside the project context.
- Not building project editing/deletion beyond what already exists in
  `NewProjectPage`/`ProjectsPage` — only swapping their data source from
  the in-memory array to Supabase.

## Foundation: demo auth + real projects

`ProjectsPage.tsx`, `NewProjectPage.tsx`, and `ProjectOverviewPage.tsx`
currently read/write `client/src/data/projects.ts` (an in-memory array).
The Supabase `projects` table from migration
`20260926000000_create_projects.sql` already has the right shape and RLS
(`owner_id = auth.uid()`), but nothing uses it yet, and there's no auth
flow to produce a session at all.

Changes:

- `supabase/seed.sql`: insert one fixed-UUID row into `auth.users` (with a
  known email/password, hashed via `crypt()`/pgcrypto, following
  Supabase's documented seed pattern) plus the matching `auth.identities`
  row so `signInWithPassword` works against it.
- `client/src/lib/supabase.ts`: on module load, if there's no session,
  call `supabase.auth.signInWithPassword` with the demo credentials from
  `VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` (new `client/.env.local` keys,
  documented in `.env.example`). No UI — this happens silently before the
  app renders (a small `await`ed bootstrap in `main.tsx`).
- `client/src/data/projects.ts` is replaced by a small `client/src/lib/projects.ts`
  with the same function shapes (`listProjects`, `getProjectById`,
  `addProject`) but backed by `supabase.from('projects')` calls, so
  `ProjectsPage`/`NewProjectPage`/`ProjectOverviewPage` need only an
  import-path and field-name (snake_case) update, not a rewrite. The
  My/Shared split in `ProjectsPage` becomes "projects you own" (all of
  them, since there's one demo user) vs. an empty shared section for now
  — shared-project sharing isn't in scope here.

This is a prerequisite, not a separate delivery — it's step 1 of the one
implementation plan, because nothing downstream can persist against a
real `project_id` without it.

## Data model

New migration `supabase/migrations/<timestamp>_documents_and_wiring_plans.sql`:

```sql
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

create table public.wiring_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  generated_at timestamptz not null default now(),
  items jsonb not null
);
```

Both tables get RLS enabled, with policies scoped through their project's
`owner_id` (`exists (select 1 from projects where projects.id =
documents.project_id and projects.owner_id = (select auth.uid()))`),
matching the existing pattern in the projects migration. This is
defense-in-depth: today the app only reads/writes these tables through
the server's service-role client (see below), never directly from the
browser, but the policies keep that true if a direct client read is ever
added later.

Storage: a new private bucket `project-documents` (configured in
`supabase/config.toml` under `[storage.buckets.project-documents]`),
object path convention `{project_id}/{document_id}/{original_filename}`.

## Server changes

`server/src/index.ts` mounts a new router:

```ts
app.use('/api/projects', projectDocumentsRouter)
```

`server/src/routes/project-documents.ts` (new):

- `POST /api/projects/:projectId/documents` — multipart (`multer`, same
  25MB/20-file limits as today). For each uploaded file:
  1. Upload the raw bytes to the `project-documents` bucket at
     `{projectId}/{docId}/{filename}` using the Supabase **service-role**
     client (server-side only — the key never reaches the browser).
  2. Run the existing `ingest` → `classifyDoc` → `extractDoc` →
     `validateExtraction` chain (unchanged) on the file.
  3. Insert a `documents` row with the result (`status: 'extracted'`,
     `extraction: <ExtractionDocument>`, `needs_review_count`) or
     `status: 'skipped_noise'` / `'error'` as today's `pipeline.ts`
     branches on.
  Response shape mirrors today's `/api/pipeline/run` (`{ results: [...] }`)
  so the new upload UI can reuse the same rendering shape as
  `PipelineTestPage`.
- `GET /api/projects/:projectId/documents` — list rows for the project
  (id, source_file, doc_type, status, needs_review_count, created_at) —
  no `extraction` payload in the list view (kept small).
- `POST /api/projects/:projectId/wiring-plan`:
  1. Load all `documents` rows with `status = 'extracted'` for the
     project.
  2. 400 if there are none.
  3. Call the new `planWiring(docs: ExtractionDocument[])` (see below).
  4. Insert a `wiring_plans` row, return it.
- `GET /api/projects/:projectId/wiring-plan` — latest row by
  `generated_at desc`, or `{ plan: null }`.

Server-side Supabase access uses the service-role key
(`SUPABASE_SERVICE_ROLE_KEY`, new `server/.env` entry) since this is a
trusted backend process, not a per-user client — it reads/writes on
behalf of whichever `projectId` the (single, demo) user's browser passed,
which is an acceptable simplification given the single-tenant, no-auth
scope of this feature.

## `server/src/pipeline/plan.ts` (new stage)

Same shape as `classify.ts`/`extract.ts`: a structured-output call against
`getOpenAI()`, using a new schema:

```ts
export const PlanConfidence = z.enum(['low', 'medium', 'high']);

export const WiringPlanItem = z.object({
  description: z.string(),
  quantity: z.string().nullable(),
  confidence: PlanConfidence,
  reason: z.string(),
  needs_info: z.string().nullable(),
  sources: z.array(z.object({ doc_id: z.string(), item_ref: z.string() })),
});

export const WiringPlan = z.object({
  items: z.array(WiringPlanItem),
});
```

`planWiring(docs: ExtractionDocument[]): Promise<WiringPlan>` sends all of
the project's extracted documents (as JSON text input, not re-sending the
original files/images — the extraction already captured what matters) in
one request to `EXTRACT_MODEL` (reuse the existing flagship-tier model;
this is the same "wrong output costs the most" tier as extraction), with
instructions adapted from `extract.ts`'s `INSTRUCTIONS`:

1. Never state a quantity, cable type, or rating that isn't present in at
   least one source document's extracted/inferred fields.
2. Every item must cite at least one `sources` entry (`doc_id` +
   `item_ref`, e.g. `"cable_schedule_rows[2].cable_type"`) it was built
   from.
3. Confidence rules, explicit in the prompt (bounding the model rather
   than leaving bucketing purely to its judgment):
   - **high**: a single document states type + quantity + destination,
     each with extraction confidence ≥ 0.8, and no other document
     contradicts it.
   - **low**: any required spec (type, quantity, or destination) is
     missing from every source, sources conflict, or every citing field's
     confidence is < 0.6.
   - **medium**: anything in between (e.g. one low-confidence source, or
     a minor unit mismatch).
4. When documents disagree (e.g. a quote lists a different cable size
   than the cable schedule), emit one item per distinct claim rather than
   silently picking one, and set `needs_info` explaining the conflict.
5. `needs_info` is non-null whenever confidence is `low` or `medium`;
   null only for `high`.

This is a pure aggregation/reconciliation pass over already-extracted
facts — no new file/vision input, no engineering computation.

## Frontend changes

- `client/src/pages/ProjectOverviewPage.tsx`: add a tab switcher
  (`Overview` / `Documents`) using local `useState`, no routing change.
  `Overview` tab is today's content unchanged.
- New `client/src/components/ProjectDocumentsTab.tsx`:
  - Upload form (same accept list/behavior as `PipelineTestPage`), posting
    to `/api/projects/:projectId/documents`.
  - Document list: source file, status badge, needs-review count —
    fetched from `GET /api/projects/:projectId/documents` on tab mount
    and refetched once after an upload completes. Uploads are handled
    synchronously (the server responds only once classify/extract/validate
    finish), so no polling loop or realtime subscription is needed.
  - "Generate Wiring Plan" button, disabled until at least one document
    has `status: 'extracted'`. Calls `POST .../wiring-plan`, then renders
    the result inline (or `GET`s the latest on tab mount so a previously
    generated plan shows without re-clicking).
  - Plan rendering: each `WiringPlanItem` as a card — description,
    quantity, a confidence pill (green/amber/red for high/medium/low),
    `reason` text, and `needs_info` shown only when non-null. Items sort
    low → medium → high so what needs attention surfaces first.
- `client/src/lib/projects.ts` (replacing `data/projects.ts`, per the
  Foundation section) is a dependency of this tab (needs a real
  `project.id` to call the new endpoints against).

## Testing & error handling

- `server/src/pipeline/plan.ts` gets a fixture check alongside the
  existing `selfcheck.ts` pattern: feed it a fixture set with (a) a clean
  single-source item → expect `high`, (b) a missing-quantity item →
  expect `low` with non-null `needs_info`, (c) two fixtures disagreeing on
  cable type for the same run → expect two items, both flagged. Reuses/extends
  `pipeline/fixtures/sample-cable-schedule.csv` and
  `sample-quote.txt`, adding a conflicting-quote fixture.
- Upload errors follow the existing pipeline pattern: never silently
  dropped, surfaced per-document in the response, source file untouched
  on disk/storage either way.
- `POST .../wiring-plan` with zero `extracted` documents → `400` with a
  clear message; the client disables the button in that state so this is
  a defensive check, not the primary UX guard.
- `client/src/lib/supabase.ts` demo sign-in failure (e.g. bad env creds)
  surfaces as a visible top-level error rather than silently leaving the
  app in a logged-out state where every Supabase call would fail with an
  opaque RLS error.

## Sequencing (for the implementation plan)

1. Foundation: seed demo user, `lib/projects.ts`, wire the three existing
   project pages to Supabase.
2. Migration: `documents` + `wiring_plans` tables + storage bucket.
3. Server: `project-documents` router (upload/list), reusing
   classify/extract/validate as-is.
4. `plan.ts` stage + its fixture-based check.
5. Server: wiring-plan endpoints.
6. Frontend: tab switcher + `ProjectDocumentsTab` (upload, document list,
   generate/view plan).
