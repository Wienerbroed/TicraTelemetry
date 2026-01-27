import e from 'express';
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

//////////////////////////////////////////// Event types ////////////////////////////////////////////

// Array for storing event types
const eventTypes = [];

// Set attribute for connected database
const database = await connectDB();

// Sets collection from database
const eventTypeCollection = database.collection('gui_event');


// Fetch 5 latest from Mongodb
const getFiveLatest = async () => {
  try {
    // Find elements and limits return to five with biggest id
    return await eventTypeCollection
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
    // Calls all event types but only saves unique event types
    const distinctEventTypes = await eventTypeCollection.distinct('event_type');

    // push event types to array
    eventTypes.push(...distinctEventTypes);

    // returns array
    return eventTypes;

    // Error catch
  } catch (err) {
    console.error('No event-type found');
    throw err;
  }
}

// Counts event types in db
const countEventTypes = async () => {
  try {
    // Load event types
    const types = await getEventType();

    // Sets event attribute
    const events = await eventTypeCollection
      .find({}, { projection: { event_type: 1 } })
      .toArray();

    // Counter
    const counts = {};

    // Initialize counters so menu order stays consistent
    types.forEach(type => counts[type] = 0);

    // Foreach loop to count event type instances
    events.forEach(event => {
      counts[event.event_type]++;
    });

    return counts;

    // Error catch
  } catch (err) {
    console.error('No event types were found');
    throw err;
  }
};

// Array for storing unique payload numbers 
const payloadNumbers = [];

// Get unique payload numbers
const getPayload = async () => {
  try {
    // Fetch unique payload numbers
    const distinctPayload = await eventTypeCollection.distinct('payload.objectsExplorerSelection');

    // Push numbers to payloadNumbers
    payloadNumbers.push(...distinctPayload);

    return payloadNumbers;

    // Error catch
  } catch (err) {
    console.error('Cannot find payload numbers')
  }
}

const payloadByEventType = async () => {
  try {
    // Aggregation pipeline
    const result = await eventTypeCollection.aggregate([
      {
        // Group by event_type and payload
        $group: {
          _id: { event_type: "$event_type", payload: "$payload.objectsExplorerSelection" },
          count: { $sum: 1 }
        }
      },
      {
        // Group again by event_type to collect all payloads
        $group: {
          _id: "$_id.event_type",
          payloads: {
            $push: {
              payload: "$_id.payload",
              count: "$count"
            }
          }
        }
      },
      {
        // Optional: rename _id to event_type
        $project: {
          _id: 0,
          event_type: "$_id",
          payloads: 1
        }
      }
    ]).toArray();

    return result;

  } catch (err) {
    console.error("Failed to fetch payloads by event type:", err.message);
    throw err;
  }
};









// Exported functions for use in other files
export { connectDB, getFiveLatest, getEventType, countEventTypes, getPayload, payloadByEventType };
