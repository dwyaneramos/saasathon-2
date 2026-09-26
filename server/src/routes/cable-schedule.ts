import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

const text = (max = 200) => z.string().max(max);
const optionalNumber = z.number().finite().nonnegative().nullable();

const CoreAllocation = z.object({
  core: text(20),
  colour: text(40),
  from: text(60),
  to: text(60),
  function: text(200),
});

/** One cable on the editable schedule. Mirrors client/src/lib/cableSchedule.ts CableRow. */
const CableRow = z.object({
  id: text(64),
  group: text(),
  cableNo: text(),
  from: text(),
  to: text(),
  cableType: text(),
  cores: text(40),
  sizeMm2: optionalNumber,
  earthMm2: optionalNumber,
  installMethod: text(),
  route: text(),
  lengthM: optionalNumber,
  voltage: z.enum(['230 V', '400 V', 'ELV']),
  protectionA: optionalNumber,
  device: z.enum(['', 'MCB', 'RCBO', 'Fuse']),
  rcd: z.boolean(),
  application: text(500),
  coreAllocation: z.array(CoreAllocation).max(100),
});

const SaveBody = z.object({ rows: z.array(CableRow).max(2000) });

const router = Router();

router.get('/:projectId/cable-schedule/saved', async (req, res) => {
  const { data, error } = await getSupabaseAdmin()
    .from('cable_schedules')
    .select('rows, updated_at')
    .eq('project_id', req.params.projectId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ rows: data?.rows ?? [], updatedAt: data?.updated_at ?? null });
});

router.put('/:projectId/cable-schedule/saved', async (req, res) => {
  const parsed = SaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `invalid cable schedule: ${parsed.error.issues[0]?.message ?? 'bad request'}` });
    return;
  }

  const { data, error } = await getSupabaseAdmin()
    .from('cable_schedules')
    .upsert({ project_id: req.params.projectId, rows: parsed.data.rows, updated_at: new Date().toISOString() })
    .select('updated_at')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ updatedAt: data.updated_at });
});

export default router;
