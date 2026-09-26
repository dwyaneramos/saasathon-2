import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

// Global lookup by id (documents.id is a UUID primary key, unique across all projects) -
// the document detail page only has the document id in its URL, not the project id.
router.get('/:documentId', async (req, res) => {
  const { documentId } = req.params;
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('documents')
    .select('id, project_id, source_file, doc_type, status, needs_review_count, error, extraction, created_at')
    .eq('id', documentId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: 'document not found' });
    return;
  }
  res.json({ document: data });
});

export default router;
