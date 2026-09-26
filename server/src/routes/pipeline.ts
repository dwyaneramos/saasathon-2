import { mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { runPipeline } from '../pipeline/pipeline.js';

const upload = multer({
  dest: path.join(tmpdir(), 'pipeline-uploads'),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});

const router = Router();

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

export default router;
