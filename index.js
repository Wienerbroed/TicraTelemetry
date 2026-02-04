//////////////////////////////////////////////// Imports ////////////////////////////////////////////////
import 'dotenv/config';
import express from 'express';
import { connectDB } from './database/db.js';
import { getEventType } from './database/eventTypes.js';
import { getUsers } from './database/user.js';
import { timeSpendByEventType, createClicksByOperation, objectSelectionByGraspGuiStart } from './database/datapool.js';

//////////////////////////////////////////////// App setup ////////////////////////////////////////////////

// Setup express
const app = express();

app.use(express.static('public'));

// Setup base elements for app
(async () => {
  // DB connection
  await connectDB();

  // Port
  const PORT = process.env.PORT || 3000;

  // Start server
  app.listen(PORT, "0.0.0.0", () => {
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
    const { startTime, endTime, employeeType } = req.query;

    const data = await createClicksByOperation({
      startTime,
      endTime,
      employeeType
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// Selection by graspGuiStart
app.get("/graspStart", async (req, res) => {
  try {
    const { startTime, endTime, employeeType } = req.query;

    const data = await objectSelectionByGraspGuiStart({
      startTime,
      endTime,
      employeeType
    });

    res.json(data); // rawEvents + total + average
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
