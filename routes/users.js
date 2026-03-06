import express from 'express';
import { getEventType } from '../Database/eventTypes.js';
import { getSessionType } from '../Database/session.js';
import { getUsers, getEmployeeTypes } from '../Database/user.js';
import { getEventQueries } from '../Database/eventQueries.js';
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