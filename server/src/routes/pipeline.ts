import { mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { checkCompliance } from '../compliance/index.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { runPipeline } from '../pipeline/pipeline.js';

const upload = multer({
  dest: path.join(tmpdir(), 'pipeline-uploads'),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});

const router = Router();

/** Extraction JSON of every successfully extracted document in the project. */
async function loadProjectExtractions(projectId: string): Promise<unknown[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('extraction')
    .eq('project_id', projectId)
    .eq('status', 'extracted');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.extraction).filter((e) => e != null);
}

router.post('/run', upload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'no files uploaded (field name must be "files")' });
    return;
  }

  const inputDir = mkdtempSync(path.join(tmpdir(), 'pipeline-input-'));
  const outputDir = mkdtempSync(path.join(tmpdir(), 'pipeline-output-'));

  try {
    for (const file of files) {
      // originalname is untrusted - strip any directory components before joining.
      renameSync(file.path, path.join(inputDir, path.basename(file.originalname)));
    }

    const manifest = await runPipeline(inputDir, outputDir);

    const results = manifest.docs.map((doc) => ({
      ...doc,
      extracted: doc.outputFile
        ? JSON.parse(readFileSync(path.join(outputDir, doc.outputFile), 'utf8'))
        : null,
    }));

    res.json({ ranAt: manifest.ranAt, skippedFiles: manifest.skippedFiles, results });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    rmSync(inputDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

// Body: { projectId?: load that project's stored extractions, documents?: extra extracted JSON,
//         design?: the project's drawing summary }
// Rules-only by default; ?ai=1 adds the (token-costing) AI second pass.
router.post('/compliance', async (req, res) => {
  const { projectId, documents = [], design } = (req.body ?? {}) as {
    projectId?: unknown;
    documents?: unknown;
    design?: unknown;
  };
  if (!Array.isArray(documents) || (projectId !== undefined && typeof projectId !== 'string')) {
    res.status(400).json({ error: '"documents" must be an array and "projectId" a string' });
    return;
  }

  try {
    const stored = typeof projectId === 'string' ? await loadProjectExtractions(projectId) : [];
    res.json(await checkCompliance([...stored, ...documents], design ?? null, { ai: req.query.ai === '1' }));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
