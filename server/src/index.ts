import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// Patches Express's router so a thrown/rejected error in an async handler reaches the
// error middleware below instead of becoming an unhandled rejection that kills the
// process - Express 4 has no built-in support for async handlers.
import 'express-async-errors';
import drawingDetectRouter from './routes/drawingDetect.js';
import helloRouter from './routes/hello.js';
import pipelineRouter from './routes/pipeline.js';
import projectDocumentsRouter from './routes/project-documents.js';
import wiringPlanRouter from './routes/wiring-plan.js';

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
// Rendered floor-plan images as base64 data URLs comfortably exceed Express's 100kb default.
app.use(express.json({ limit: '25mb' }));

app.use('/api/hello', helloRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/drawing', drawingDetectRouter);
app.use('/api/projects', projectDocumentsRouter);
app.use('/api/projects', wiringPlanRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Catches anything a route handler threw or rejected with (see express-async-errors
// above) so one broken request returns a 500 instead of crashing every other request
// the server is handling.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
