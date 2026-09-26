import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import drawingDetectRouter from './routes/drawingDetect.js';
import helloRouter from './routes/hello.js';
import pipelineRouter from './routes/pipeline.js';

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
// Rendered floor-plan images as base64 data URLs comfortably exceed Express's 100kb default.
app.use(express.json({ limit: '25mb' }));

app.use('/api/hello', helloRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/drawing', drawingDetectRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
