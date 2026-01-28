import { connectDB } from "./db.js";

// Set attribute for connected database
const database = await connectDB();


// Sets collection from database
const eventTypeCollection = database.collection('gui_event');


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
    const result = await eventTypeCollection.aggregate([
      {
        // Convert payload object → array so we can filter keys
        $addFields: {
          filteredPayload: {
            $arrayToObject: {
              $filter: {
                input: { $objectToArray: "$payload" },
                as: "item",
                cond: {
                  $not: {
                    $in: ["$$item.k", ["className", "object", "Application Title", "classname", "name"]]
                  }
                }
              }
            }
          }
        }
      },
      {
        // Group using filtered payload
        $group: {
          _id: {
            event_type: "$event_type",
            payload: "$filteredPayload"
          },
          count: { $sum: 1 }
        }
      },
      {
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


// Exports
export { getPayload, payloadByEventType};