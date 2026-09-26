import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyDoc } from './classify.js';
import { extractDoc } from './extract.js';
import { ingest, type IngestSkip } from './ingest.js';
import { validateExtraction } from './validate.js';

export interface RunManifestEntry {
  docId: string;
  sourceFile: string;
  status: 'extracted' | 'skipped_all_noise' | 'error';
  outputFile: string | null;
  needsReviewCount: number;
  error: string | null;
}

export interface RunManifest {
  ranAt: string;
  inputDir: string;
  outputDir: string;
  docs: RunManifestEntry[];
  /** Unsupported file types - logged so nothing silently vanishes, never deleted from disk. */
  skippedFiles: IngestSkip[];
}

export async function runPipeline(inputDir: string, outputDir: string): Promise<RunManifest> {
  mkdirSync(outputDir, { recursive: true });
  const { docs, skipped } = ingest(inputDir);

  const manifest: RunManifest = {
    ranAt: new Date().toISOString(),
    inputDir,
    outputDir,
    docs: [],
    skippedFiles: skipped,
  };

  for (const doc of docs) {
    try {
      const classification = await classifyDoc(doc);
      const allNoise = classification.pages.length > 0 && classification.pages.every((p) => p.is_noise);
      if (allNoise) {
        manifest.docs.push({
          docId: doc.docId,
          sourceFile: doc.sourceFile,
          status: 'skipped_all_noise',
          outputFile: null,
          needsReviewCount: 0,
          error: null,
        });
        continue;
      }

      const extracted = await extractDoc(doc, classification);
      const validated = validateExtraction(extracted);

      const outputFile = `${doc.docId}.json`;
      writeFileSync(path.join(outputDir, outputFile), JSON.stringify(validated, null, 2));

      manifest.docs.push({
        docId: doc.docId,
        sourceFile: doc.sourceFile,
        status: 'extracted',
        outputFile,
        needsReviewCount: validated.needs_review.length,
        error: null,
      });
    } catch (err) {
      // Errors are logged, never silently swallowed - the source file is untouched either way.
      manifest.docs.push({
        docId: doc.docId,
        sourceFile: doc.sourceFile,
        status: 'error',
        outputFile: null,
        needsReviewCount: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}
