import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ResponseInputContent } from 'openai/resources/responses/responses';
import { redactText } from './redact.js';

type ContentBlock = ResponseInputContent;

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.tsv']);

export interface IngestedDoc {
  docId: string;
  sourceFile: string; // path relative to the input root
  /** Content block to embed in the API request for this whole document. */
  contentBlock: ContentBlock;
}

export interface IngestSkip {
  sourceFile: string;
  reason: string;
}

export interface IngestResult {
  docs: IngestedDoc[];
  skipped: IngestSkip[];
}

function docIdFor(relPath: string): string {
  return createHash('sha1').update(relPath).digest('hex').slice(0, 12);
}

function listFiles(inputDir: string): string[] {
  return readdirSync(inputDir, { recursive: true })
    .map((entry) => entry.toString())
    .filter((rel) => statSync(path.join(inputDir, rel)).isFile());
}

export function ingest(inputDir: string): IngestResult {
  const docs: IngestedDoc[] = [];
  const skipped: IngestSkip[] = [];

  for (const relPath of listFiles(inputDir)) {
    const absPath = path.join(inputDir, relPath);
    const ext = path.extname(relPath).toLowerCase();
    const docId = docIdFor(relPath);

    if (ext === '.pdf') {
      const data = readFileSync(absPath).toString('base64');
      docs.push({
        docId,
        sourceFile: relPath,
        contentBlock: {
          type: 'input_file',
          filename: path.basename(relPath),
          file_data: `data:application/pdf;base64,${data}`,
        },
      });
      continue;
    }

    if (ext in IMAGE_MEDIA_TYPES) {
      const data = readFileSync(absPath).toString('base64');
      docs.push({
        docId,
        sourceFile: relPath,
        contentBlock: {
          type: 'input_image',
          detail: 'auto',
          image_url: `data:${IMAGE_MEDIA_TYPES[ext]};base64,${data}`,
        },
      });
      continue;
    }

    if (TEXT_EXTENSIONS.has(ext)) {
      const text = redactText(readFileSync(absPath, 'utf8'));
      docs.push({ docId, sourceFile: relPath, contentBlock: { type: 'input_text', text } });
      continue;
    }

    skipped.push({
      sourceFile: relPath,
      reason: `unsupported file type "${ext || '(none)'}" - supported: .pdf, .png/.jpg/.jpeg/.webp/.gif, .txt/.csv/.tsv`,
    });
  }

  return { docs, skipped };
}
