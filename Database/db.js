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

//////////////////////////////////////////// Payload ////////////////////////////////////////////

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

// Get payload by event type
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

    // Catch error
  } catch (err) {
    console.error("Failed to fetch payloads by event type:", err.message);
    throw err;
  }
};

//////////////////////////////////////////// Users ////////////////////////////////////////////

// Array to store uniqu users
const userList = [];

// Fetch users
const getUsers = async () => {
  try {
    const distinctUsers = await eventTypeCollection.distinct('user_name');

    userList.push(...distinctUsers);

    return userList;

  } catch (err) {
    console.error('No users found', err.message);
    throw err;
  }
}

//count users
const userInteractionCount = async () => {
  try {
    // Load users in db
    const userage = await getUsers();

    // Sets user attributes
    const users = await eventTypeCollection
      .find({}, {projection: {user_name: 1}})
      .toArray();
    
      // Counter
      const counts = {};

      // stets user start count for users
      userage.forEach(user=> counts[user] = 0);

      // foreach to count users 
      users.forEach(user => {
        counts[user.user_name]++;
      });

      return counts;

  } catch (err) {
    console.error('No users found');
    throw err;
  }
}

// get payload data by users
const actionsByUsers = async () => {
  try {
    const result = await eventTypeCollection.aggregate([
      {
        // Step 1: Normalize payload
        $addFields: {
          normalizedPayload: {
            $cond: [
              { $ifNull: ["$payload.objectsExplorerSelection", false] },
              "$payload.objectsExplorerSelection",
              {
                myfield: "$payload.myfield",
                otherField: "$payload.otherField"
              }
            ]
          }
        }
      },
      {
        // Step 2: Group by user and normalized payload
        $group: {
          _id: { user_name: "$user_name", payload: "$normalizedPayload" },
          count: { $sum: 1 }
        }
      },
      {
        // Step 3: Aggregate payloads per user
        $group: {
          _id: "$_id.user_name",
          payloads: {
            $push: {
              payload: "$_id.payload",
              count: "$count"
            }
          }
        }
      },
      {
        // Step 4: Clean output
        $project: {
          _id: 0,
          event_type: "$_id",
          payloads: 1
        }
      }
    ]).toArray();

    return result;
  } catch (err) {
    console.error("No payload found");
    throw err;
  }
};



// Exported functions for use in other files
export { connectDB, getFiveLatest, getEventType, countEventTypes, getPayload, payloadByEventType, getUsers, userInteractionCount, actionsByUsers };
