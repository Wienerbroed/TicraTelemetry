import { connectDB } from "./db.js";

const database = await connectDB();
const eventTypeCollection = database.collection('gui_event');


const getEventType = async () => {
  const eventTypes = await eventTypeCollection.distinct("event_type");
  return eventTypes;
};

export { getEventType };
