import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from "url";
import path from "path";
import { connectDB } from './Database/db.js';
import { getEventType } from './Database/eventTypes.js';
import { getSessionType } from './Database/session.js';
import { getUsers, getEmployeeTypes } from './Database/user.js';
import { fetchDataPoolByQueries, sessionFetchByQueries, sessionTimeline } from './Database/datapool.js';
import { createConfig, getConfigQuery, getRawConfig, listConfigs, updateConfig, deleteConfig } from './Database/configManager.js';
import { getEventQueries } from './Database/eventQueries.js';

const app = express();

// Multer setup for memory storage (store files in memory, not disk)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to DB
(async () => {
  await connectDB();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

// =================== ROUTES ===================

// Home
app.get('/', (req, res) => res.send('Hello World!'));

// Event types
app.get('/event', async (req, res) => {
  try { res.json(await getEventType()); } 
  catch { res.status(500).send('Error fetching data'); }
});

// Event queries
app.get('/eventQueries', async (req, res) => {
  try { res.json(await getEventQueries()); } 
  catch { res.status(500).send('Error fetching data'); }
});

// Session types
app.get('/sessionTypes', async (req, res) => {
  try { res.json(await getSessionType()); } 
  catch { res.status(500).send('Error fetching data'); }
});

// Users
app.get('/users', async (req, res) => {
  try { res.json(await getUsers()); } 
  catch { res.status(500).send('Error fetching data'); }
});

// Employee types
app.get("/employeeTypes", async (req, res) => {
  try { res.json(await getEmployeeTypes()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Data pool
app.get("/data", async (req, res) => {
  try {
    const { startTime, endTime, employeeType, inputEventType: title } = req.query;

    if (!title) return res.status(400).json({ error: "Config title is required" });
    if (!startTime || !endTime) return res.status(400).json({ error: "startTime and endTime are required" });

    // Step 1: Look up config by title
    const config = await getRawConfig(title); // title from frontend
    if (!config) return res.status(404).json({ error: "Config not found" });

    const actualEventType = config.event_type; // use event_type for querying gui_event

    // Step 2: Fetch events using actual event_type
    const data = await fetchDataPoolByQueries({ startTime, endTime, employeeType, inputEventType: actualEventType });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Sessions
app.get("/session", async (req, res) => {
  try {
    const { startTime, endTime, user_name, configTitle, employee_type } = req.query;

    if (!configTitle) return res.status(400).json({ error: "configTitle query parameter is required" });

    // ✅ Step 1: Look up config
    const config = await getRawConfig(configTitle);
    if (!config) return res.status(404).json({ error: "Config not found" });

    const eventType = config.event_type; // <-- use this for gui_event query

    // ✅ Step 2: Pass eventType to sessionFetchByQueries
    const data = await sessionFetchByQueries({
      configTitle,
      startTime,
      endTime,
      user_name,
      employee_type,
      inputEventType: eventType  // <-- add this
    });

    res.json(data);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
});


// Session timeline
app.get("/sessionTimeline", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "sessionId query parameter is required" });
    const data = await sessionTimeline({ sessionId });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =================== CONFIG MANAGER ===================

// List all configs
app.get("/api/configs", async (req, res) => {
  try { res.json(await listConfigs()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Get raw config
app.get("/api/configs/:title", async (req, res) => {
  try {
    const config = await getRawConfig(req.params.title);
    if (!config) return res.status(404).json({ error: "Config not found" });
    res.json(config);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get query from config
app.get("/api/configs/:title/query", async (req, res) => {
  try { res.json(await getConfigQuery(req.params.title)); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Create config (with optional image & description)
app.post("/api/configs", upload.single('image'), async (req, res) => {
  try {
    const { title, mode, event_type, payload_field, description } = req.body;
    const extra_query = {};

    if (req.file) {
      extra_query.image = { data: req.file.buffer.toString('base64'), contentType: req.file.mimetype };
    }

    const config = await createConfig({ title, mode, event_type, payload_field, description, extra_query });
    res.json(config);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Update config (with optional image & description)
app.put("/api/configs/:title", upload.single('image'), async (req, res) => {
  try {
    const oldTitle = req.params.title;
    const { title, mode, event_type, payload_field, description } = req.body;

    const updates = { title, mode, event_type, payload_field, description };

    if (req.file) {
      updates.extra_query = { ...updates.extra_query, image: { data: req.file.buffer.toString('base64'), contentType: req.file.mimetype } };
    }

    const result = await updateConfig(oldTitle, updates);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete config
app.delete("/api/configs/:title", async (req, res) => {
  try { res.json(await deleteConfig(req.params.title)); } 
  catch (err) { res.status(400).json({ error: err.message }); }
});
