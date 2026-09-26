import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
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

export interface IngestedPage {
  /** 1-indexed page number within the source file. */
  page: number;
  /** Content covering just this one page - extraction calls use this so a large multi-page
   * file never has to fit inside a single request's output-token budget. */
  contentBlock: ContentBlock;
}

export interface IngestedDoc {
  docId: string;
  sourceFile: string; // path relative to the input root
  /** Content block for the whole document - used by the cheap triage/classification pass. */
  contentBlock: ContentBlock;
  /** One entry per page, in order. Length 1 for non-PDF files. */
  pages: IngestedPage[];
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

/** Splits a PDF into single-page PDFs so extraction can process one page per API call - a
 * multi-page file sent whole risks the extraction response truncating mid-JSON well before it
 * reaches the later pages (see incompleteReason in client.ts). */
async function splitPdfPages(raw: Buffer, relPath: string): Promise<IngestedPage[]> {
  const source = await PDFDocument.load(raw);
  const baseName = path.basename(relPath, path.extname(relPath));

  const pages: IngestedPage[] = [];
  for (let i = 0; i < source.getPageCount(); i += 1) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(source, [i]);
    single.addPage(copied);
    const bytes = await single.save();
    pages.push({
      page: i + 1,
      contentBlock: {
        type: 'input_file',
        filename: `${baseName}-p${i + 1}.pdf`,
        file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`,
      },
    });
  }
  return pages;
}

export async function ingest(inputDir: string): Promise<IngestResult> {
  const docs: IngestedDoc[] = [];
  const skipped: IngestSkip[] = [];

  for (const relPath of listFiles(inputDir)) {
    const absPath = path.join(inputDir, relPath);
    const ext = path.extname(relPath).toLowerCase();
    const docId = docIdFor(relPath);

    if (ext === '.pdf') {
      const raw = readFileSync(absPath);
      const contentBlock: ContentBlock = {
        type: 'input_file',
        filename: path.basename(relPath),
        file_data: `data:application/pdf;base64,${raw.toString('base64')}`,
      };
      docs.push({ docId, sourceFile: relPath, contentBlock, pages: await splitPdfPages(raw, relPath) });
      continue;
    }

    if (ext in IMAGE_MEDIA_TYPES) {
      const data = readFileSync(absPath).toString('base64');
      const contentBlock: ContentBlock = {
        type: 'input_image',
        detail: 'auto',
        image_url: `data:${IMAGE_MEDIA_TYPES[ext]};base64,${data}`,
      };
      docs.push({ docId, sourceFile: relPath, contentBlock, pages: [{ page: 1, contentBlock }] });
      continue;
    }

    if (TEXT_EXTENSIONS.has(ext)) {
      const text = redactText(readFileSync(absPath, 'utf8'));
      const contentBlock: ContentBlock = { type: 'input_text', text };
      docs.push({ docId, sourceFile: relPath, contentBlock, pages: [{ page: 1, contentBlock }] });
      continue;
    }

    skipped.push({
      sourceFile: relPath,
      reason: `unsupported file type "${ext || '(none)'}" - supported: .pdf, .png/.jpg/.jpeg/.webp/.gif, .txt/.csv/.tsv`,
    });
  }

  return { docs, skipped };
}
