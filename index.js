//////////////////////////////////////////////// Imports ////////////////////////////////////////////////
import 'dotenv/config';
import express from 'express';
import { connectDB } from './database/db.js';
import { getEventType, countEventTypes } from './database/eventTypes.js';
import { getPayload, payloadByEventType } from './database/payload.js';
import { getUsers, userInteractionCount, actionsByUsers, userTimeExpenditureByPayload } from './database/user.js';
import { timeSpendByEventType, clicksByOperation, objectSelectionByGraspGuiStart } from './database/datapool.js';

//////////////////////////////////////////////// App setup ////////////////////////////////////////////////

// Setup express
const app = express();

app.use(express.static('public'));

// Setup base elements for app
(async () => {

  // Calls db connection function
  await connectDB();

  // Sets Port and returns port in console
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

//////////////////////////////////////////////// Routing ////////////////////////////////////////////////

// index page
app.get('/', (req, res) => {
  res.send('Hello World!');
});


// event type page
app.get('/event', async (req, res) => {
  try {
    // Calls get event type function
    const data = await getEventType();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});


app.get('/count', async (req, res) => {
  try {
    // Calls get event type function
    const data = await countEventTypes();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});


// payload type page
app.get('/payload', async (req, res) => {
  try {
    // Calls get event type function
    const data = await getPayload();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});


// payload type page
app.get('/payloadevent', async (req, res) => {
  try {
    // Calls get event type function
    const data = await payloadByEventType();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});


// users type page
app.get('/users', async (req, res) => {
  try {
    // Calls get event type function
    const data = await getUsers();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});


// users type page
app.get('/usercount', async (req, res) => {
  try {
    // Calls get event type function
    const data = await userInteractionCount();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});


// users type page
app.get('/userinteraction', async (req, res) => {
  try {
    // Calls get event type function
    const data = await actionsByUsers();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});


// users type page
app.get('/time', async (req, res) => {
  try {
    // Calls get event type function
    const data = await userTimeExpenditureByPayload();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});

// Time spent pr event data pool
app.get('/pool', async (req, res) => {
  try {
    // Calls get event type function
    const data = await timeSpendByEventType();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
});

// Clicks on create instances
app.get("/create", async (req, res) => {
  try {
    const data = await clicksByOperation();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Selection by graspGuiStart
app.get("/graspStart", async (req, res) => {
  try {
    const data = await objectSelectionByGraspGuiStart();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
