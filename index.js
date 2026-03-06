import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from "url";
import path from "path";
import { connectDB } from './Database/db.js';
import dataRouter from './routes/data.js';
import usersRouter from './routes/users.js';
import configsRouter from './routes/configs.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// =================== ROUTERS ===================
app.use('/', usersRouter);
app.use('/', dataRouter);
app.use('/api/configs', configsRouter);

// =================== GLOBAL ERROR HANDLER ===================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// =================== DB CONNECT & START SERVER ===================
(async () => {
  await connectDB();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
})();