import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { connectDB } from "./db.js";
import { timeIntervalFilter, employeeTypeFilter } from "./db.js";

// setup for json import
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const poolConfigPath = join(__dirname, "./config/queries.json");
const sessionConfigPath = join(__dirname, "./config/sessions.json");



// Database logic
const database = await connectDB();

const dbCollection = database.collection('gui_event');


// Functions
const fetchDataPoolByQueries = async ({inputEventType, startTime, endTime, employeeType} = {}) => {
  try {
    if (!inputEventType) throw new Error("inputEventType is required");

    // calls json file and reads it
    const data = await readFile(poolConfigPath, "utf-8");
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


const sessionFetchByQueries = async ({ startTime, endTime, user_name } = {}) => {
  try {
    // connect to config file
    const data = await readFile(sessionConfigPath, "utf-8");
    const config = JSON.parse(data);
    const eventConfig = config["TabpageSessions"];

    const payloadFields = Object.keys(eventConfig.fields).filter(f =>
      f.startsWith("payload.")
    );
    if (payloadFields.length === 0) throw new Error("No payload Configured");

    const payloadField = payloadFields[0];
    const [payloadObj, payloadKey] = payloadField.split(".");

    const matchFilter = {
      ...eventConfig.query,
      ...timeIntervalFilter(startTime, endTime),
    };

    if (user_name) matchFilter.user_name = user_name;

    //query for database and fetch
    const events = await dbCollection
      .find(matchFilter)
      .sort({ time_stamp: 1 })
      .toArray();

    // Group events by user_name + session_id
    const groupedSessions = {};
    for (const event of events) {
      const key = `${event.user_name}_${event.session_id}`;
      if (!groupedSessions[key]) groupedSessions[key] = [];
      groupedSessions[key].push(event);
    }

    // calculator for time spent by session and payload
    const sessionResults = [];
    const employeeTabTotals = {};
    const employeeSessionCounts = {};

    for (const [sessionKey, sessionEvents] of Object.entries(groupedSessions)) {
      if (!sessionEvents.length) continue;

      const user = sessionEvents[0].user_name;
      const sessionId = sessionEvents[0].session_id;

      employeeSessionCounts[user] =
        (employeeSessionCounts[user] || 0) + 1;

      // Aggregate per tab within this session
      const tabAggregation = {};

      for (let i = 0; i < sessionEvents.length; i++) {
        const current = sessionEvents[i];
        const next = sessionEvents[i + 1];

        const currentTab =
          current?.[payloadObj]?.[payloadKey] || "Unknown";

        let durationSeconds = 0;

        if (
          next &&
          next.session_id === current.session_id &&
          next.user_name === current.user_name
        ) {
          durationSeconds =
            (new Date(next.time_stamp) -
              new Date(current.time_stamp)) / 1000;
        }

        if (!tabAggregation[currentTab]) {
          tabAggregation[currentTab] = {
            user_name: user,
            session_id: sessionId,
            tab: currentTab,
            start_time: current.time_stamp,
            end_time: next ? next.time_stamp : current.time_stamp,
            durationSeconds: 0,
            session_end: false,
          };
        }

        tabAggregation[currentTab].durationSeconds += durationSeconds;

        // Keep earliest start_time
        if (new Date(current.time_stamp) < new Date(tabAggregation[currentTab].start_time)) {
          tabAggregation[currentTab].start_time = current.time_stamp;
        }

        // Keep latest end_time
        if (next && new Date(next.time_stamp) > new Date(tabAggregation[currentTab].end_time)) {
          tabAggregation[currentTab].end_time = next.time_stamp;
        }

        // If last event in session → mark session_end
        if (!next) {
          tabAggregation[currentTab].session_end = true;
        }
      }

      // Push aggregated session tabs
      for (const tabData of Object.values(tabAggregation)) {
        sessionResults.push(tabData);

        // Aggregate employee totals
        if (!employeeTabTotals[user]) {
          employeeTabTotals[user] = {};
        }
        if (!employeeTabTotals[user][tabData.tab]) {
          employeeTabTotals[user][tabData.tab] = 0;
        }
        employeeTabTotals[user][tabData.tab] += tabData.durationSeconds;
      }
    }

    // total and average calculators
    const totalsPerEmployee = {};
    const averagesPerEmployee = {};

    for (const [user, tabTotals] of Object.entries(employeeTabTotals)) {
      totalsPerEmployee[user] = {};
      averagesPerEmployee[user] = {};

      const sessionCount = employeeSessionCounts[user] || 1;

      for (const [tab, totalSeconds] of Object.entries(tabTotals)) {
        totalsPerEmployee[user][tab] = totalSeconds;
        averagesPerEmployee[user][tab] =
          totalSeconds / sessionCount;
      }
    }

    return {
      sessions: sessionResults,  // now 1 tab per session
      totals: totalsPerEmployee,
      averages: averagesPerEmployee,
    };
  } catch (err) {
    console.error("Error fetching data", err);
    throw err;
  }
};




export { fetchDataPoolByQueries, sessionFetchByQueries };