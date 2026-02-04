import { connectDB } from "./db.js";
import { timeIntervalFilter, employeeTypeFilter } from "./db.js";

// Set attribute for database
const database = await connectDB();

// Set collection to fetch data from in database
const dbCollection = database.collection('gui_event');


const formatSelectionLabel = value => {

  if (value === null) return "null";
  
  if (typeof value === "string") return `"${value}"`;
  return String(value);
};




const timeSpendByEventType = async () => {
    try {
        // Calls database
        const events = await dbCollection

            // queries db by username and returns selected data from elements
            .find(
                { user_name: { $exists: true } },
                {
                    projection: {
                        // does not return id
                        _id: 0,
                        user_name: 1,
                        event_type: 1,
                        time_stamp: 1,
                        event_number: 1
                    }
                }
            )
            // sorts data fecthed and adds to array
            .sort({ user_name: 1, time_stamp: 1, event_number: 1 })
            .toArray();

        const perUser = {};
        const pooled = {};

        // goes through each event and pool accordingly
        for (let i = 0; i < events.length; i++) {
            const curr = events[i];
            const next = events[i + 1];

            let time_spent = 0;

            // Calculates time by username 
            if (next && curr.user_name === next.user_name) {
                const currTime = new Date(curr.time_stamp).getTime();
                const nextTime = new Date(next.time_stamp).getTime();

                if (
                    nextTime > currTime &&
                    // checks if next event number is bigger to confirm ongoing session
                    next.event_number >= curr.event_number
                ) {
                    time_spent = (nextTime - currTime) / 60000;
                }
            }

            const eventType = curr.event_type ?? "unknown";
            const user = curr.user_name;

            // Checks if user exists and adds if not. Push time data to array.
            if (!perUser[user]) perUser[user] = [];

            perUser[user].push({
                event_type: eventType,
                time_spent
            });

            // Check if event type exists if not it's added. Connect eventrype to users
            if (!pooled[eventType]) {
                pooled[eventType] = {
                    total_time: 0,
                    users: new Set()
                };
            }

            pooled[eventType].total_time += time_spent;
            pooled[eventType].users.add(user);
        }

        // Creates and average for all event times, based on amount of users
        const averages = Object.entries(pooled).map(
            ([event_type, data]) => ({
                event_type,
                avg_time_spent:
                    data.users.size === 0
                        ? 0
                        : data.total_time / data.users.size
            })
        );

        return { perUser, averages };

    } catch (err) {
        console.error("Error calculating time spent:", err);
        throw err;
    }
};



const createClicksByOperation = async ({ startTime, endTime, employeeType } = {}) => {
  try {
    // Build query based on time interval and employee type
    const query = {
      event_type: "Create",
      "payload.operation": { $exists: true },
      ...timeIntervalFilter(startTime, endTime),
      ...employeeTypeFilter(employeeType)
    };

    // Queries specific data from mongoDb element
    const rawEvents = await dbCollection
      .find(query, {
        projection: {
          // does not return id
          _id: 0,
          user_name: 1,
          employee_type: 1,
          time_stamp: 1,
          "payload.operation": 1
        }
      })
      // adds found quries and elements to array
      .toArray();

    const perUser = {};
    const operationSet = new Set();
    const employeeTypeSet = new Set();

    // Build per-user aggregates
    rawEvents.forEach(doc => {
      const user = doc.user_name ?? "unknown";
      // calls formation function to make sure data is handled correctly
      const op = formatSelectionLabel(doc.payload.operation);
      const type = doc.employee_type ?? "unknown";

      operationSet.add(op);
      employeeTypeSet.add(type);

      // search for found user and add is not in set, else adds data to user
      if (!perUser[user]) perUser[user] = [];

      // search for existing selection in specific user
      const existing = perUser[user].find(s => s.selection === op);
      if (existing) {
        existing.clicks += 1;
      } else {

        // adds new selection to set if selection not found
        perUser[user].push({
          selection: op,
          clicks: 1,
          employee_type: type
        });
      }
    });

    const operations = Array.from(operationSet).sort();
    const employeeTypes = Array.from(employeeTypeSet).sort();

    // Data returned
    return {
      perUser,
      operations,
      employeeTypes,
      // time interval
      rawEvents 
    };
  } catch (err) {
    console.error("Error calculating clicks:", err);
    throw err;
  }
};


const objectSelectionByGraspGuiStart = async ({ startTime, endTime, employeeType } = {}) => {
  try {

    // Query to fetch objectEplorerSelection if event type = GraspGUI Start
    const query = {
      event_type: "GraspGUI Start",
      "payload.objectsExplorerSelection": { $exists: true },
      // Filters for time interval and employee types
      ...timeIntervalFilter(startTime, endTime),
      ...employeeTypeFilter(employeeType)
    };

    // Queries specified data from mongoDb element
    const selections = await dbCollection
      .find(query, {
        projection: {
          // returns no id
          _id: 0,
          user_name: 1,
          employee_type: 1,
          time_stamp: 1,
          "payload.objectsExplorerSelection": 1
        }
      })
      // pushes query data to array
      .toArray();

    // sets rules for data returned
    const rawEvents = selections.map(doc => {
      let sel = doc.payload.objectsExplorerSelection;

      // --- backend normalization: pool numeric strings & numbers, keep null separate ---
      if (sel === null || sel === undefined) {
        sel = null; // explicitly mark null values
      } else if (!isNaN(sel)) {
        sel = Number(sel); // numeric strings -> numbers
      } else {
        sel = String(sel); // everything else as string
      }

      return {
        user: doc.user_name ?? "unknown",
        employee_type: doc.employee_type ?? "unknown",
        selection: sel,
        time_stamp: doc.time_stamp
      };
    });

    // compute totals
    const total = {};
    const perUser = {};

    rawEvents.forEach(e => {
      if (!perUser[e.user]) perUser[e.user] = [];
      
      // sets rules for finding selection
      const existing = perUser[e.user].find(s => s.selection === e.selection);
      if (existing) existing.clicks++;
      
      // Creates new selection obejct if not exist
      else perUser[e.user].push({ selection: e.selection, clicks: 1 });

      total[e.selection] = (total[e.selection] || 0) + 1;
    });

    // compute averages
    // sets amount to even out by
    const userCount = Object.keys(perUser).length || 1;
    const average = {};

    // Average out all selection elements
    Object.keys(total).forEach(sel => {
      average[sel] = total[sel] / userCount;
    });

    return { rawEvents, total, average };

  } catch (err) {
    console.error("Error fetching GraspGUI data:", err);
    throw err;
  }
};


export { timeSpendByEventType, createClicksByOperation, objectSelectionByGraspGuiStart };