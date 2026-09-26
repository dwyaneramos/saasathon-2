import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { planWiring } from '../pipeline/plan.js';
import type { ExtractionDocument } from '../pipeline/schema.js';

const router = Router();

router.post('/:projectId/wiring-plan', async (req, res) => {
  const { projectId } = req.params;
  const admin = getSupabaseAdmin();

  const { data: rows, error: fetchError } = await admin
    .from('documents')
    .select('extraction')
    .eq('project_id', projectId)
    .eq('status', 'extracted');

  if (fetchError) {
    res.status(500).json({ error: fetchError.message });
    return;
  }

  const docs = (rows ?? [])
    .map((row) => row.extraction as ExtractionDocument | null)
    .filter((doc): doc is ExtractionDocument => doc != null);

  if (docs.length === 0) {
    res.status(400).json({ error: 'no extracted documents for this project yet' });
    return;
  }

  try {
    const plan = await planWiring(docs);
    const { data: inserted, error: insertError } = await admin
      .from('wiring_plans')
      .insert({ project_id: projectId, items: plan.items })
      .select('id, project_id, generated_at, items')
      .single();
    if (insertError) throw new Error(insertError.message);
    res.json(inserted);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/:projectId/wiring-plan', async (req, res) => {
  const { projectId } = req.params;
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('wiring_plans')
    .select('id, project_id, generated_at, items')
    .eq('project_id', projectId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ plan: data ?? null });
});

export default router;
