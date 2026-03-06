import express from 'express';
import { fetchDataPoolByQueries, sessionFetchByQueries, sessionTimeline } from '../database/datapool.js';
import { getRawConfig } from '../database/configManager.js';
import { asyncHandler, requireQueryParams } from './utils.js';

const router = express.Router();

// =================== DATA POOL ===================
router.get('/data', requireQueryParams(['inputEventType', 'startTime', 'endTime']), asyncHandler(async (req, res) => {
  const { startTime, endTime, employeeType, inputEventType: title } = req.query;

  const config = await getRawConfig(title);
  if (!config) return res.status(404).json({ error: "Config not found" });

  const data = await fetchDataPoolByQueries({ startTime, endTime, employeeType, inputEventType: config.event_type });
  res.json(data);
}));

// =================== SESSIONS ===================
router.get('/session', requireQueryParams(['configTitle', 'startTime', 'endTime']), asyncHandler(async (req, res) => {
  const { configTitle, startTime, endTime, user_name, employee_type } = req.query;

  const config = await getRawConfig(configTitle);
  if (!config) return res.status(404).json({ error: "Config not found" });

  const data = await sessionFetchByQueries({
    configTitle,
    startTime,
    endTime,
    user_name,
    employee_type,
    inputEventType: config.event_type
  });
  res.json(data);
}));

// =================== SESSION TIMELINE ===================
router.get('/sessionTimeline', requireQueryParams(['sessionId']), asyncHandler(async (req, res) => {
  const { sessionId } = req.query;
  const data = await sessionTimeline({ sessionId });
  res.json(data);
}));

export default router;