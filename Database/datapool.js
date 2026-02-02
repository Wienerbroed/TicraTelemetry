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


// Fetch and pool data 
const timeSpendByEventType = async () => {
    try {
        const events = await dbCollection
            .find(
                { user_name: { $exists: true } },
                {
                    projection: {
                        _id: 0,
                        user_name: 1,
                        event_type: 1,
                        time_stamp: 1,
                        event_number: 1
                    }
                }
            )
            .sort({ user_name: 1, time_stamp: 1, event_number: 1 })
            .toArray();

        const perUser = {};
        const pooled = {};

        for (let i = 0; i < events.length; i++) {
            const curr = events[i];
            const next = events[i + 1];

            let time_spent = 0;

            if (next && curr.user_name === next.user_name) {
                const currTime = new Date(curr.time_stamp).getTime();
                const nextTime = new Date(next.time_stamp).getTime();

                if (
                    nextTime > currTime &&
                    next.event_number >= curr.event_number
                ) {
                    time_spent = (nextTime - currTime) / 60000;
                }
            }

            const eventType = curr.event_type ?? "unknown";
            const user = curr.user_name;

            // ---------- per-user ----------
            if (!perUser[user]) perUser[user] = [];
            perUser[user].push({
                event_type: eventType,
                time_spent
            });

            // ---------- pooled averages ----------
            if (!pooled[eventType]) {
                pooled[eventType] = {
                    total_time: 0,
                    users: new Set()
                };
            }

            pooled[eventType].total_time += time_spent;
            pooled[eventType].users.add(user);
        }

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


// Pool Create usage
const clicksByOperation = async ({ startTime, endTime, employeeType } = {}) => {
  try {
    // Build query
    const query = {
      event_type: "Create",
      "payload.operation": { $exists: true },
      ...timeIntervalFilter(startTime, endTime),
      ...employeeTypeFilter(employeeType)
    };

    // Fetch raw events
    const rawEvents = await dbCollection
      .find(query, {
        projection: {
          _id: 0,
          user_name: 1,
          employee_type: 1,
          time_stamp: 1,
          "payload.operation": 1
        }
      })
      .toArray();

    const perUser = {};
    const operationSet = new Set();
    const employeeTypeSet = new Set();

    // Build per-user aggregates
    rawEvents.forEach(doc => {
      const user = doc.user_name ?? "unknown";
      const op = formatSelectionLabel(doc.payload.operation);
      const type = doc.employee_type ?? "unknown";

      operationSet.add(op);
      employeeTypeSet.add(type);

      if (!perUser[user]) perUser[user] = [];
      const existing = perUser[user].find(s => s.selection === op);
      if (existing) {
        existing.clicks += 1;
      } else {
        perUser[user].push({
          selection: op,
          clicks: 1,
          employee_type: type
        });
      }
    });

    const operations = Array.from(operationSet).sort();
    const employeeTypes = Array.from(employeeTypeSet).sort();

    // Compute totals
    const totals = {};
    operations.forEach(op => {
      totals[op] = Object.values(perUser).reduce((sum, userOps) => {
        const obj = userOps.find(s => s.selection === op);
        return sum + (obj ? obj.clicks : 0);
      }, 0);
    });

    // Compute averages
    const averages = {};
    operations.forEach(op => {
      averages[op] = Object.keys(perUser).length
        ? parseFloat((totals[op] / Object.keys(perUser).length).toFixed(2))
        : 0;
    });

    return {
      perUser,
      operations,
      totals,
      averages,
      employeeTypes,
      rawEvents // <-- important: raw events with timestamps
    };
  } catch (err) {
    console.error("Error calculating clicks:", err);
    throw err;
  }
};

// Pool GraspUiStart by objectsExplorerSelection
const objectSelectionByGraspGuiStart = async ({
  startTime,
  endTime,
  employeeType
} = {}) => {
  try {
    const query = {
      event_type: "GraspGUI Start",
      "payload.objectsExplorerSelection": { $exists: true },
      ...timeIntervalFilter(startTime, endTime),
      ...employeeTypeFilter(employeeType)
    };

    const selections = await dbCollection
      .find(query, {
        projection: {
          _id: 0,
          user_name: 1,
          employee_type: 1,
          time_stamp: 1,
          "payload.objectsExplorerSelection": 1
        }
      })
      .toArray();

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

    // --- compute totals and averages ---
    const total = {};
    const perUser = {};
    rawEvents.forEach(e => {
      if (!perUser[e.user]) perUser[e.user] = [];
      const existing = perUser[e.user].find(s => s.selection === e.selection);
      if (existing) existing.clicks++;
      else perUser[e.user].push({ selection: e.selection, clicks: 1 });

      total[e.selection] = (total[e.selection] || 0) + 1;
    });

    const userCount = Object.keys(perUser).length || 1;
    const average = {};
    Object.keys(total).forEach(sel => {
      average[sel] = total[sel] / userCount;
    });

    return { rawEvents, total, average };

  } catch (err) {
    console.error("Error fetching GraspGUI data:", err);
    throw err;
  }
};




export { timeSpendByEventType, clicksByOperation, objectSelectionByGraspGuiStart };