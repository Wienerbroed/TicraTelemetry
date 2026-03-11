// testServer.js
import 'dotenv/config';
import express from 'express';
import { connectDB } from './database/db.js';
import dataRouter from './routes/data.js';
import usersRouter from './routes/users.js';
import configsRouter from './routes/configs.js';

export async function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // routers
  app.use('/', usersRouter);
  app.use('/', dataRouter);
  app.use('/api/configs', configsRouter);

  // global error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  // connect DB
  await connectDB();

  return app;
}