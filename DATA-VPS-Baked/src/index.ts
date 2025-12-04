import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
dotenv.config();
import chainsRouter from './routes/chains';
import validatorsRouter from './routes/validators';
import validatorRouter from './routes/validator';
import validatorDetailRouter from './routes/validator-detail';
import blocksRouter from './routes/blocks';
import transactionsRouter from './routes/transactions';
import networkRouter from './routes/network';
import uptimeRouter from './routes/uptime';
import keybaseRouter from './routes/keybase';
import transactionRouter from './routes/transaction';
import proposalsRouter from './routes/proposals';
import proposalRouter from './routes/proposal';
import parametersRouter from './routes/parameters';
import assetsRouter from './routes/assets';
import assetDetailRouter from './routes/asset-detail';
import accountsRouter from './routes/accounts';
import statsRouter from './routes/stats';
import cacheStatsRouter from './routes/cache-stats';
const app = express();
const PORT = process.env.PORT || 4000;
export const cache = new NodeCache({
  stdTTL: 30,
  checkperiod: 60,
  useClones: false,
  maxKeys: 500
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cache.getStats()
  });
});
app.use('/api/chains', chainsRouter);
app.use('/api/validators', validatorsRouter);
app.use('/api/validator', validatorDetailRouter); // Register detail routes first (includes /transactions)
app.use('/api/validator', validatorRouter); // Then register general validator route
app.use('/api/blocks', blocksRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/network', networkRouter);
app.use('/api/uptime', uptimeRouter);
app.use('/api/keybase', keybaseRouter);
app.use('/api/transaction', transactionRouter);
app.use('/api/proposals', proposalsRouter);
app.use('/api/proposal', proposalRouter);
app.use('/api/parameters', parametersRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/asset-detail', assetDetailRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/cache', cacheStatsRouter);
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Cache TTL: ${cache.options.stdTTL}s`);
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  cache.flushAll();
  process.exit(0);
});
