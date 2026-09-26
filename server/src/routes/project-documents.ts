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
  extraction: unknown | null;
}

interface UploadResult {
  results: DocumentResult[];
  skippedFiles: { sourceFile: string; reason: string }[];
}

type Job =
  | { status: 'pending' }
  | { status: 'done'; result: UploadResult }
  | { status: 'error'; error: string };

// In-memory only - fine for a single-instance dev deploy. Each job is cleared a few
// minutes after it finishes so this never grows unbounded.
const jobs = new Map<string, Job>();
const JOB_TTL_MS = 5 * 60 * 1000;

async function runUpload(jobId: string, projectId: string, inputDir: string) {
  const admin = getSupabaseAdmin();

  try {
    const { docs, skipped } = await ingest(inputDir);
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
            extraction: null,
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
          extraction: validated,
        });
      } catch (err) {
        // Errors are logged per-document, never silently swallowed or allowed to abort
        // the rest of the batch - the source file is untouched either way.
        let message = err instanceof Error ? err.message : String(err);
        console.error(`[documents] ${projectId}/${doc.sourceFile} failed: ${message}`);
        const { data: inserted, error: recordError } = await admin
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
        if (recordError) {
          // Otherwise the failure vanishes: nothing in the documents list, nothing in the UI.
          console.error(`[documents] couldn't record the failure for ${doc.sourceFile}: ${recordError.message}`);
          message += ` (and it couldn't be saved to the documents list: ${recordError.message})`;
        }
        results.push({
          docId: inserted?.id ?? storageId,
          sourceFile: doc.sourceFile,
          status: 'error',
          needsReviewCount: 0,
          error: message,
          extraction: null,
        });
      }
    }

    jobs.set(jobId, { status: 'done', result: { results, skippedFiles: skipped } });
  } catch (err) {
    console.error(`[documents] upload for project ${projectId} failed:`, err);
    jobs.set(jobId, { status: 'error', error: err instanceof Error ? err.message : String(err) });
  } finally {
    rmSync(inputDir, { recursive: true, force: true });
    setTimeout(() => jobs.delete(jobId), JOB_TTL_MS).unref();
  }
}

// Starts the (often 30-90s+ per document - each one is a real vision-model call)
// classify/extract pipeline in the background and returns immediately. A single
// request held open that long doesn't survive every proxy/tunnel in front of this
// server, so the client polls GET .../documents/jobs/:jobId instead of waiting on
// one long response.
router.post('/:projectId/documents', upload.array('files'), (req, res) => {
  const { projectId } = req.params;
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'no files uploaded (field name must be "files")' });
    return;
  }

  const inputDir = mkdtempSync(path.join(tmpdir(), 'project-doc-input-'));
  for (const file of files) {
    // originalname is untrusted - strip any directory components before joining.
    renameSync(file.path, path.join(inputDir, path.basename(file.originalname)));
  }

  const jobId = randomUUID();
  jobs.set(jobId, { status: 'pending' });
  void runUpload(jobId, projectId, inputDir);
  res.status(202).json({ jobId });
});

router.get('/:projectId/documents/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'unknown or expired job id' });
    return;
  }
  res.json(job);
});

router.get('/:projectId/documents', async (req, res) => {
  const { projectId } = req.params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('documents')
    .select('id, source_file, doc_type, status, needs_review_count, created_at, extraction, error')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ documents: data });
});

export default router;
