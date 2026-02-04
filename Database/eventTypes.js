import { connectDB } from "./db.js";

// Set attribute for connected database
const database = await connectDB();


// Sets collection from database
const eventTypeCollection = database.collection('gui_event');


// Array for storing event types
const eventTypes = [];



const getEventType = async () => {
  try {
    // Calls all event types but only saves unique event types
    const distinctEventTypes = await eventTypeCollection.distinct('event_type');

    // add event types to array
    eventTypes.push(...distinctEventTypes);

    return eventTypes;

  } catch (err) {
    console.error('No event-type found');
    throw err;
  }
};



export { getEventType };