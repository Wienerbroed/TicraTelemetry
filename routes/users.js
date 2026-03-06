import express from 'express';
import { getEventType } from '../database/eventTypes.js';
import { getSessionType } from '../database/session.js';
import { getUsers, getEmployeeTypes } from '../database/user.js';
import { getEventQueries } from '../database/eventQueries.js';
import { asyncHandler } from './utils.js';

const router = express.Router();

// Home
router.get('/', (req, res) => res.send('Hello World!'));

// Users & Event Routes
router.get('/event', asyncHandler(async (req, res) => res.json(await getEventType())));
router.get('/eventQueries', asyncHandler(async (req, res) => res.json(await getEventQueries())));
router.get('/sessionTypes', asyncHandler(async (req, res) => res.json(await getSessionType())));
router.get('/users', asyncHandler(async (req, res) => res.json(await getUsers())));
router.get('/employeeTypes', asyncHandler(async (req, res) => res.json(await getEmployeeTypes())));

export default router;