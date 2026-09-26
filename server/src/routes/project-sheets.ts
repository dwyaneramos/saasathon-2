import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { runPipeline } from '../pipeline/pipeline.js';

const STORAGE_BUCKET = 'project-documents';

// Kept in step with the client's REQUIRED_SHEET_TYPES (client/src/data/sheets.ts). The
// server is authoritative: an unrecognised tag is rejected rather than stored, so the
// completeness check can never be satisfied by a value the UI doesn't understand.
const SHEET_TYPES = [
  'power_plan',
  'lighting_rcp_plan',
  'panel_schedule',
  'single_line_diagram',
  'lv_specialty',
  'site_plan',
] as const;

const REQUIRED_SHEET_TYPES = ['power_plan', 'panel_schedule', 'single_line_diagram'];

const upload = multer({
  dest: path.join(tmpdir(), 'project-sheet-uploads'),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

const router = Router();

interface SheetRow {
  id: string;
  source_file: string;
  sheet_type: string;
  size_bytes: number | null;
  status: string;
  created_at: string;
}

const SHEET_COLUMNS = 'id, source_file, sheet_type, size_bytes, status, created_at';

function isSheetType(value: unknown): value is (typeof SHEET_TYPES)[number] {
  return typeof value === 'string' && (SHEET_TYPES as readonly string[]).includes(value);
}

/** Stores a sheet without processing it - intake is deliberately cheap. */
router.post('/:projectId/sheets', upload.single('file'), async (req, res) => {
  const { projectId } = req.params;
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ error: 'no file uploaded (field name must be "file")' });
    return;
  }
  if (!isSheetType(req.body?.sheet_type)) {
    rmSync(file.path, { force: true });
    res.status(400).json({ error: `sheet_type must be one of: ${SHEET_TYPES.join(', ')}` });
    return;
  }

  const admin = getSupabaseAdmin();
  // A random id per upload, so two sheets with the same original filename never collide
  // in Storage or overwrite each other.
  const storagePath = `${projectId}/${randomUUID()}/${path.basename(file.originalname)}`;

  try {
    const bytes = readFileSync(file.path);
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { upsert: false });
    if (uploadError) throw new Error(`storage upload failed: ${uploadError.message}`);

    const { data, error } = await admin
      .from('documents')
      .insert({
        project_id: projectId,
        storage_path: storagePath,
        source_file: path.basename(file.originalname),
        doc_type: null,
        status: 'intake',
        sheet_type: req.body.sheet_type,
        size_bytes: bytes.byteLength,
        needs_review_count: 0,
        error: null,
        extraction: null,
      })
      .select(SHEET_COLUMNS)
      .single();
    if (error) {
      // Don't leave an orphaned object behind if the row didn't land.
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw new Error(error.message);
    }
    res.status(201).json({ sheet: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    rmSync(file.path, { force: true });
  }
});

router.get('/:projectId/sheets', async (req, res) => {
  const { projectId } = req.params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('documents')
    .select(SHEET_COLUMNS)
    .eq('project_id', projectId)
    .not('sheet_type', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const sheets = (data ?? []) as SheetRow[];
  const supplied = new Set(sheets.map((s) => s.sheet_type));
  res.json({
    sheets,
    requiredSheetTypes: REQUIRED_SHEET_TYPES,
    missingSheetTypes: REQUIRED_SHEET_TYPES.filter((t) => !supplied.has(t)),
  });
});

router.delete('/:projectId/sheets/:sheetId', async (req, res) => {
  const { projectId, sheetId } = req.params;
  const admin = getSupabaseAdmin();

  const { data: row, error: lookupError } = await admin
    .from('documents')
    .select('storage_path')
    .eq('id', sheetId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (lookupError) {
    res.status(500).json({ error: lookupError.message });
    return;
  }
  if (!row) {
    res.status(404).json({ error: 'sheet not found for this project' });
    return;
  }

  const { error } = await admin.from('documents').delete().eq('id', sheetId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  // Best-effort: the row is already gone, so a storage failure must not fail the request.
  await admin.storage.from(STORAGE_BUCKET).remove([row.storage_path as string]);
  res.json({ ok: true });
});

/**
 * Runs the canonical batch pipeline over every unprocessed sheet in the set. Deliberately
 * all-or-nothing per project: the merge step needs the whole set, so processing a
 * two-of-three set would produce confidently wrong cross-references.
 */
router.post('/:projectId/sheets/process', async (req, res) => {
  const { projectId } = req.params;
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('documents')
    .select('id, source_file, storage_path, sheet_type')
    .eq('project_id', projectId)
    .not('sheet_type', 'is', null)
    .in('status', ['intake', 'pending']);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const pending = (data ?? []) as {
    id: string;
    source_file: string;
    storage_path: string;
    sheet_type: string;
  }[];

  const supplied = new Set(pending.map((s) => s.sheet_type));
  const missing = REQUIRED_SHEET_TYPES.filter((t) => !supplied.has(t));
  if (missing.length > 0) {
    res.status(409).json({ error: `drawing set is incomplete - still missing: ${missing.join(', ')}` });
    return;
  }
  if (pending.length === 0) {
    res.status(409).json({ error: 'every sheet in this set has already been processed' });
    return;
  }

  const inputDir = mkdtempSync(path.join(tmpdir(), 'sheet-input-'));
  const outputDir = mkdtempSync(path.join(tmpdir(), 'sheet-output-'));

  try {
    // runPipeline keys results by the input path, so each temp file gets a unique prefix
    // and a map back to its row. The original extension is kept - ingest type-detects on it.
    const rowIdBySourceFile = new Map<string, string>();
    for (const [index, sheet] of pending.entries()) {
      const { data: blob, error: downloadError } = await admin.storage
        .from(STORAGE_BUCKET)
        .download(sheet.storage_path);
      if (downloadError) throw new Error(`could not read ${sheet.source_file}: ${downloadError.message}`);

      const sourceFile = `${index}-${path.basename(sheet.source_file)}`;
      writeFileSync(path.join(inputDir, sourceFile), Buffer.from(await blob.arrayBuffer()));
      rowIdBySourceFile.set(sourceFile, sheet.id);
    }

    const manifest = await runPipeline(inputDir, outputDir);
    const statusByKind: Record<string, string> = {
      extracted: 'extracted',
      skipped_all_noise: 'skipped_noise',
      error: 'error',
    };

    for (const entry of manifest.docs) {
      const rowId = rowIdBySourceFile.get(entry.sourceFile);
      if (!rowId) continue;

      const extraction = entry.outputFile
        ? JSON.parse(readFileSync(path.join(outputDir, entry.outputFile), 'utf8'))
        : null;

      const { error: updateError } = await admin
        .from('documents')
        .update({
          status: statusByKind[entry.status] ?? 'error',
          doc_type: extraction?.doc_type ?? null,
          needs_review_count: entry.needsReviewCount,
          error: entry.error,
          extraction,
        })
        .eq('id', rowId);
      if (updateError) throw new Error(updateError.message);
    }

    res.json({
      ranAt: manifest.ranAt,
      processed: manifest.docs.length,
      skippedFiles: manifest.skippedFiles,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    rmSync(inputDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

export default router;
