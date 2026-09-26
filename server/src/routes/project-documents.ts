import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { classifyDoc } from '../pipeline/classify.js';
import { extractDoc } from '../pipeline/extract.js';
import { ingest } from '../pipeline/ingest.js';
import { validateExtraction } from '../pipeline/validate.js';

const upload = multer({
  dest: path.join(tmpdir(), 'project-doc-uploads'),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});

const router = Router();

interface DocumentResult {
  docId: string;
  sourceFile: string;
  status: 'extracted' | 'skipped_noise' | 'error';
  needsReviewCount: number;
  error: string | null;
}

router.post('/:projectId/documents', upload.array('files'), async (req, res) => {
  const { projectId } = req.params;
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'no files uploaded (field name must be "files")' });
    return;
  }

  const inputDir = mkdtempSync(path.join(tmpdir(), 'project-doc-input-'));
  const admin = getSupabaseAdmin();

  try {
    for (const file of files) {
      // originalname is untrusted - strip any directory components before joining.
      renameSync(file.path, path.join(inputDir, path.basename(file.originalname)));
    }

    const { docs, skipped } = ingest(inputDir);
    const results: DocumentResult[] = [];

    for (const doc of docs) {
      // A random id per upload, not doc.sourceFile/docId, so two documents with the
      // same original filename (even across separate requests) never collide in Storage.
      const storageId = randomUUID();
      const storagePath = `${projectId}/${storageId}/${path.basename(doc.sourceFile)}`;

      try {
        const classification = await classifyDoc(doc);
        const allNoise = classification.pages.length > 0 && classification.pages.every((p) => p.is_noise);

        const absPath = path.join(inputDir, doc.sourceFile);
        const { error: uploadError } = await admin.storage
          .from('project-documents')
          .upload(storagePath, readFileSync(absPath), { upsert: false });
        if (uploadError) throw new Error(`storage upload failed: ${uploadError.message}`);

        if (allNoise) {
          const { data: inserted, error: dbError } = await admin
            .from('documents')
            .insert({
              project_id: projectId,
              storage_path: storagePath,
              source_file: doc.sourceFile,
              doc_type: null,
              status: 'skipped_noise',
              needs_review_count: 0,
              error: null,
              extraction: null,
            })
            .select('id')
            .single();
          if (dbError) throw new Error(dbError.message);

          results.push({
            docId: inserted.id,
            sourceFile: doc.sourceFile,
            status: 'skipped_noise',
            needsReviewCount: 0,
            error: null,
          });
          continue;
        }

        const extracted = await extractDoc(doc, classification);
        const validated = validateExtraction(extracted);

        const { data: inserted, error: dbError } = await admin
          .from('documents')
          .insert({
            project_id: projectId,
            storage_path: storagePath,
            source_file: doc.sourceFile,
            doc_type: validated.doc_type,
            status: 'extracted',
            needs_review_count: validated.needs_review.length,
            error: null,
            extraction: validated,
          })
          .select('id')
          .single();
        if (dbError) throw new Error(dbError.message);

        results.push({
          docId: inserted.id,
          sourceFile: doc.sourceFile,
          status: 'extracted',
          needsReviewCount: validated.needs_review.length,
          error: null,
        });
      } catch (err) {
        // Errors are logged per-document, never silently swallowed or allowed to abort
        // the rest of the batch - the source file is untouched either way.
        const message = err instanceof Error ? err.message : String(err);
        const { data: inserted } = await admin
          .from('documents')
          .insert({
            project_id: projectId,
            storage_path: storagePath,
            source_file: doc.sourceFile,
            doc_type: null,
            status: 'error',
            needs_review_count: 0,
            error: message,
            extraction: null,
          })
          .select('id')
          .single();
        results.push({
          docId: inserted?.id ?? storageId,
          sourceFile: doc.sourceFile,
          status: 'error',
          needsReviewCount: 0,
          error: message,
        });
      }
    }

    res.json({ results, skippedFiles: skipped });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    rmSync(inputDir, { recursive: true, force: true });
  }
});

router.get('/:projectId/documents', async (req, res) => {
  const { projectId } = req.params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('documents')
    .select('id, source_file, doc_type, status, needs_review_count, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ documents: data });
});

export default router;
