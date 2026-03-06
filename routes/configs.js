import express from 'express';
import multer from 'multer';
import { createConfig, getConfigQuery, getRawConfig, listConfigs, updateConfig, deleteConfig } from '../database/configManager.js';
import { asyncHandler, processFile } from './utils.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// List configs
router.get('/', asyncHandler(async (req, res) => res.json(await listConfigs())));

// Get raw config
router.get('/:title', asyncHandler(async (req, res) => {
  const config = await getRawConfig(req.params.title);
  if (!config) return res.status(404).json({ error: "Config not found" });
  res.json(config);
}));

// Get query from config
router.get('/:title/query', asyncHandler(async (req, res) => res.json(await getConfigQuery(req.params.title))));

// Create config
router.post('/', upload.single('image'), asyncHandler(async (req, res) => {
  const { title, mode, event_type, payload_field, description } = req.body;
  const extra_query = {};
  const fileData = processFile(req.file);
  if (fileData) extra_query.image = fileData;

  const config = await createConfig({ title, mode, event_type, payload_field, description, extra_query });
  res.json(config);
}));

// Update config
router.put('/:title', upload.single('image'), asyncHandler(async (req, res) => {
  const oldTitle = req.params.title;
  const { title, mode, event_type, payload_field, description } = req.body;

  const updates = { title, mode, event_type, payload_field, description };
  const fileData = processFile(req.file);
  if (fileData) updates.extra_query = { ...updates.extra_query, image: fileData };

  const result = await updateConfig(oldTitle, updates);
  res.json(result);
}));

// Delete config
router.delete('/:title', asyncHandler(async (req, res) => res.json(await deleteConfig(req.params.title))));

export default router;