import 'dotenv/config';
import express from 'express';
import { connectDB } from './database/db.js';
import { getEventType } from './database/eventTypes.js';
import { getUsers } from './database/user.js';
import {  fetchDataPoolByQueries, sessionFetchByQueries } from './database/datapool.js';

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
app.get('/', (req, res) => {
  res.send('Hello World!');
});



app.get('/event', async (req, res) => {
  try {
    // Calls get event type function
    const data = await getEventType();
    res.json(data);

  } catch {
    res.status(500).send('Error fetching data');
  }
});



app.get('/users', async (req, res) => {
  try {
    // Calls get event type function
    const data = await getUsers();
    res.json(data);

  } catch {
    res.status(500).send('Error fetching data');
  }
});



app.get("/data", async (req, res) => {
  try {
    // set query for fontend
    const { startTime, endTime, employeeType, inputEventType } = req.query;

    // insert query values to backend
    const data = await fetchDataPoolByQueries({
      startTime,
      endTime,
      employeeType,
      inputEventType
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



app.get("/seesion", async(req, res) =>{
  try{
    const {startTime, endTime, user_name} = req.query;
    const data = await sessionFetchByQueries({
      startTime,
      endTime,
      user_name
    });

    res.json(data);
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
});
