import 'dotenv/config';
import express from 'express';
import { connectDB, getFiveLatest, getEventType } from './database/db.js';

// Setup express
const app = express();

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

//////////////////////////////////////////////// Routing /////////////////////////////////////////

// index page
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// latest page
app.get('/latest', async (req, res) => {
  try {
    // Calls get 5 latest and return in json format on page
    const data = await getFiveLatest();
    res.json(data);

    // Catch error
  } catch {
    res.status(500).send('Error fetching data');
  }
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
