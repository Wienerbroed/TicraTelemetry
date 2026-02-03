import { connectDB } from "./db.js";

// Set attribute for connected database
const database = await connectDB();


// Sets collection from database
const eventTypeCollection = database.collection('gui_event');


// Array for storing event types
const eventTypes = [];


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
};


// Exports
export { getEventType };