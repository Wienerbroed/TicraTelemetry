import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { connectDB } from "./db.js";
import { timeIntervalFilter, employeeTypeFilter } from "./db.js";

// setup for json import
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, "./config/queries.json");



// Database logic
const database = await connectDB();

const dbCollection = database.collection('gui_event');


// Functions
const fetchDataPoolByQueries = async ({inputEventType, startTime, endTime, employeeType} = {}) => {
  try {
    if (!inputEventType) throw new Error("inputEventType is required");

    // calls json file and reads it
    const data = await readFile(configPath, "utf-8");
    const config = JSON.parse(data);

    const eventConfig = config[inputEventType];
    if (!eventConfig) throw new Error(`Event type "${inputEventType}" not found in config`);

    // Extract payload field from config (only one field is expected)
    const payloadFields = Object.keys(eventConfig.fields).filter(f => f.startsWith("payload."));
    if (payloadFields.length === 0) throw new Error("No payload fields configured for this event");

    const payloadField = payloadFields[0]; 
    const payloadKey = payloadField.split('.').pop();

    // Build match filter
    const matchFilter = {
      ...eventConfig.query,
      ...timeIntervalFilter(startTime, endTime),
      ...employeeTypeFilter(employeeType)
    };

    // Aggregation pipeline
    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: {
            user_name: "$user_name",
            event_type: "$event_type",
            employee_type: "$employee_type",
            payload_value: `$${payloadField}`
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          user_name: "$_id.user_name",
          event_type: "$_id.event_type",
          employee_type: "$_id.employee_type",
          payload: { [payloadKey]: "$_id.payload_value" },
          count: 1
        }
      }
    ];

    const events = await dbCollection.aggregate(pipeline).toArray();

    // returns found data from db
    return {
      meta: {
        inputEventType,
        count: events.length
      },
      events
    };

  } catch (err) {
    console.error("Error fetching data pool:", err);
    throw err;
  }
};



export { fetchDataPoolByQueries };