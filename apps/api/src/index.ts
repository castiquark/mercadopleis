import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { servicesRouter } from './routes/services';
import { ordersRouter } from './routes/orders';
import { disputesRouter } from './routes/disputes';
import { reviewsRouter } from './routes/reviews';
import { baseIndexer } from './indexer/baseIndexer';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mercadopleis-api',
    chainId: config.chainId,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/services', servicesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/reviews', reviewsRouter);

// Start server
app.listen(config.port, () => {
  console.log(`[API] mercadopleis backend listening on port ${config.port}`);
  baseIndexer.start();
});
