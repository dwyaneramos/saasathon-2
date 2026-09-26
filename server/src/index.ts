import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import helloRouter from './routes/hello.js';
import pipelineRouter from './routes/pipeline.js';

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

app.use('/api/hello', helloRouter);
app.use('/api/pipeline', pipelineRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
