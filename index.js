import 'dotenv/config';
import express from 'express';
import { connectDB } from './database/db.js';
import { getEventType } from './database/eventTypes.js';
import { getSessionType } from './database/session.js';
import { getUsers } from './database/user.js';
import { fetchDataPoolByQueries, sessionFetchByQueries } from './database/datapool.js';
import { appendJson, deleteJson, updateJson } from './database/config/configManager.js';
import { getEventQueries } from './database/eventQueries.js';
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

//////////////////////////////////////////////// App setup ////////////////////////////////////////////////
const app = express();


// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(express.static('public'));


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const jsonFiles = {
  queries: "database/config/queries.json",
  sessions: "database/config/sessions.json"
};


// Connect to DB and start server
(async () => {
  await connectDB();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

//////////////////////////////////////////////// Routing ////////////////////////////////////////////////
app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.get('/event', async (req, res) => {
  try {
    const data = await getEventType();
    res.json(data);
  } catch {
    res.status(500).send('Error fetching data');
  }
});


app.get('/eventQueries', async (req, res) => {
  try {
    const data = await getEventQueries();
    res.json(data);
  } catch {
    res.status(500).send('Error fetching data');
  }
});


app.get('/sessionTypes', async (req, res) => {
  try {
    const data = await getSessionType();
    res.json(data);
  } catch {
    res.status(500).send('Error fetching data');
  }
});


app.get('/users', async (req, res) => {
  try {
    const data = await getUsers();
    res.json(data);
  } catch {
    res.status(500).send('Error fetching data');
  }
});


app.get("/data", async (req, res) => {
  try {
    const { startTime, endTime, employeeType, inputEventType } = req.query;
    const data = await fetchDataPoolByQueries({ startTime, endTime, employeeType, inputEventType });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.get("/session", async (req, res) => {
  try {
    const { startTime, endTime, user_name, eventType } = req.query;

    if (!eventType) {
      return res.status(400).json({ error: "eventType query parameter is required" });
    }

    const data = await sessionFetchByQueries({ eventType, startTime, endTime, user_name });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


/////////////////////////////// Config Manager Endpoints ////////////////////////////////////
app.get("/api/config-files", (req, res) => {
  res.json(Object.keys(jsonFiles));
});


app.get("/api/:fileKey/queries", async (req, res) => {
  try {
    const { fileKey } = req.params;
    if (!jsonFiles[fileKey]) return res.status(400).json({ error: "Invalid file key" });

    const data = await fs.readFile(path.join(__dirname, jsonFiles[fileKey]), "utf8");
    res.json(data.trim() ? JSON.parse(data) : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/api/:fileKey/queries", async (req, res) => {
  const { fileKey } = req.params;
  const { title, eventType, payloadPath } = req.body;

  if (!title || !eventType || !payloadPath) {
    return res.status(400).json({ error: "title, eventType, and payloadPath are required" });
  }

  try {
    await appendJson(fileKey, title, eventType, payloadPath);
    res.json({ message: "Query added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put("/api/:fileKey/queries/:key", async (req, res) => {
  const { fileKey, key } = req.params;
  const { title, eventType, payloadPath } = req.body;

  if (!title || !eventType || !payloadPath) {
    return res.status(400).json({ error: "title, eventType, and payloadPath are required" });
  }

  try {
    await updateJson(fileKey, key, title, eventType, payloadPath);
    res.json({ message: "Query updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.delete("/api/:fileKey/queries/:key", async (req, res) => {
  const { fileKey, key } = req.params;
  try {
    await deleteJson(fileKey, key);
    res.json({ message: "Query deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
