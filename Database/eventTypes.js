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


// Exports
export { getEventType, countEventTypes};