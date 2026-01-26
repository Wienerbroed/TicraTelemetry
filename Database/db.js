import { MongoClient } from 'mongodb';

// Enviromental variables
const username = encodeURIComponent(process.env.MONGO_USER);
const password = encodeURIComponent(process.env.MONGO_PASSWORD);

// Database URL
const uri = `mongodb+srv://${username}:${password}@telemetry.tgndpzv.mongodb.net/?retryWrites=true&w=majority`;

// Attributes
let client;
let db;

// Connect to Mongodb
const connectDB = async () => {
  if (db) {
    return db;
  }

  try {
    // Set client to database
    client = new MongoClient(uri);

    // Check connction
    await client.connect();

    // Sets db
    db = client.db('gui_event_db');
    console.log('MongoDB Atlas connected');

    // Return db
    return db;

    // Error catch
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// Fetch 5 latest from Mongodb
const getFiveLatest = async () => {
  try {
    // Connects database
    const database = await connectDB();

    // Sets collection from database
    const collection = database.collection('gui_event');

    // Find elements and limits return to five with biggest id
    return await collection
      .find({})
      .sort({ _id: -1 })
      .limit(5)
      .toArray();

    // Error catch
  } catch (err) {
    console.error('Failed to fetch latest records:', err.message);
    throw err;
  }
};

// Fetch event types
const getEventType = async () => {
  try {
    // Connects database
    const database = await connectDB();

    // Sets collection from database
    const collection = database.collection('gui_event');

    // Calls alle event types but only saves unique event types
    return await collection.distinct('event_type');

    // Error catch
  } catch (err) {
    console.error('No event-type found');
    throw err;
  }
}


// Exported functions for use in other files
export { connectDB, getFiveLatest, getEventType };
