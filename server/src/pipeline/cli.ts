import 'dotenv/config';
import path from 'node:path';
import { runPipeline } from './pipeline.js';

function parseArgs(argv: string[]): { input: string; output: string } {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg?.startsWith('--')) {
      args.set(arg.slice(2), argv[i + 1] ?? '');
      i += 1;
    }
  }
  return {
    input: path.resolve(args.get('input') ?? 'data/input'),
    output: path.resolve(args.get('output') ?? 'data/output'),
  };
}

const { input, output } = parseArgs(process.argv.slice(2));
const manifest = await runPipeline(input, output);

const extracted = manifest.docs.filter((d) => d.status === 'extracted').length;
const skippedNoise = manifest.docs.filter((d) => d.status === 'skipped_all_noise').length;
const errors = manifest.docs.filter((d) => d.status === 'error').length;
const needsReview = manifest.docs.reduce((sum, d) => sum + d.needsReviewCount, 0);

console.log(
  `Processed ${manifest.docs.length} document(s) from ${input} -> ${output}\n` +
    `  extracted: ${extracted}\n` +
    `  skipped (all pages noise): ${skippedNoise}\n` +
    `  errors: ${errors}\n` +
    `  unsupported files skipped: ${manifest.skippedFiles.length}\n` +
    `  needs_review items: ${needsReview}\n` +
    `  manifest: ${path.join(output, 'manifest.json')}`,
);

if (errors > 0) process.exitCode = 1;
