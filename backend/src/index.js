import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import matchesRouter from './routes/matches.js';
import playersRouter from './routes/players.js';
import chatRouter from './routes/chat.js';
import seasonsRouter from './routes/seasons.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/matches', matchesRouter);
app.use('/api/players', playersRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/chat', chatRouter);
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

app.listen(3001, () => console.log('API on :3001'));
