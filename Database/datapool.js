//////////////////////////////////////////////// setup ////////////////////////////////////////////////
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

//////////////////////////////////////////////// Helper functions ////////////////////////////////////////////////
const buildEventQueryConfig = async ({ inputEventType, startTime, endTime, employeeType }) => {
  if (!inputEventType) {
    throw new Error("inputEventType is required");
  }

  // Read config file
  const data = await readFile(poolConfigPath, "utf-8");
  const config = JSON.parse(data);

  const eventConfig = config[inputEventType];
  if (!eventConfig) {
    throw new Error(`Event type "${inputEventType}" not found in config`);
  }

  // Extract payload field
  const payloadFields = Object.keys(eventConfig.fields)
    .filter(f => f.startsWith("payload."));

  if (payloadFields.length === 0) {
    throw new Error("No payload fields configured for this event");
  }

  const payloadField = payloadFields[0];
  const payloadKey = payloadField.split(".").pop();

  // Build match filter
  const matchFilter = {
    ...eventConfig.query,
    ...timeIntervalFilter(startTime, endTime),
    ...employeeTypeFilter(employeeType)
  };

  return {
    payloadField,
    payloadKey,
    matchFilter
  };
};


const getSessionConfig = async (inputEventType) => {
  if (!inputEventType) throw new Error("inputEventType is required");

  const data = await readFile(sessionConfigPath, "utf-8");
  const config = JSON.parse(data);

  const eventConfig = config[inputEventType];

  if (!eventConfig) {
    throw new Error(`Event type "${inputEventType}" not found in session config`);
  }

  const payloadFields = Object.keys(eventConfig.fields)
    .filter(f => f.startsWith("payload."));

  if (payloadFields.length === 0) {
    throw new Error("No payload fields configured for this event");
  }

  const payloadField = payloadFields[0];
  const [payloadObj, payloadKey] = payloadField.split(".");

  return {
    eventConfig,
    payloadObj,
    payloadKey
  };
};



const buildSessionMatchFilter = ({ eventConfig, startTime, endTime, user_name }) => {
  const matchFilter = {
    ...eventConfig.query,
    ...timeIntervalFilter(startTime, endTime),
  };

  if (user_name) {
    matchFilter.user_name = user_name;
  }

  return matchFilter;
};


const groupEventsBySession = (events) => {
  return events.reduce((acc, event) => {
    const key = `${event.user_name}_${event.session_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
};


const aggregateSessions = ( groupedSessions, payloadObj, payloadKey ) => {
  const sessionResults = [];
  const employeeTabTotals = {};
  const employeeSessionCounts = {};

  for (const sessionEvents of Object.values(groupedSessions)) {
    if (!sessionEvents.length) continue;

    const user = sessionEvents[0].user_name;
    const sessionId = sessionEvents[0].session_id;

    employeeSessionCounts[user] =
      (employeeSessionCounts[user] || 0) + 1;

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

      if (new Date(current.time_stamp) <
          new Date(tabAggregation[currentTab].start_time)) {
        tabAggregation[currentTab].start_time = current.time_stamp;
      }

      if (next &&
          new Date(next.time_stamp) >
          new Date(tabAggregation[currentTab].end_time)) {
        tabAggregation[currentTab].end_time = next.time_stamp;
      }

      if (!next) {
        tabAggregation[currentTab].session_end = true;
      }
    }

    for (const tabData of Object.values(tabAggregation)) {
      sessionResults.push(tabData);

      if (!employeeTabTotals[user]) {
        employeeTabTotals[user] = {};
      }

      employeeTabTotals[user][tabData.tab] =
        (employeeTabTotals[user][tabData.tab] || 0) +
        tabData.durationSeconds;
    }
  }

  return {
    sessionResults,
    employeeTabTotals,
    employeeSessionCounts
  };
};


const calculateEmployeeStats = (
  employeeTabTotals,
  employeeSessionCounts
) => {
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

  return { totalsPerEmployee, averagesPerEmployee };
};



//////////////////////////////////////////////// Functions ////////////////////////////////////////////////
const fetchDataPoolByQueries = async ({ inputEventType, startTime, endTime, employeeType } = {}) => {
  try {

    const { payloadField, payloadKey, matchFilter } =
      await buildEventQueryConfig({
        inputEventType,
        startTime,
        endTime,
        employeeType
      });

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



const sessionFetchByQueries = async ({ eventType, startTime, endTime, user_name } = {}) => {
  if (!eventType) throw new Error("eventType is required");

  const { eventConfig, payloadObj, payloadKey } = await getSessionConfig(eventType);

  const matchFilter = buildSessionMatchFilter({
    eventConfig,
    startTime,
    endTime,
    user_name
  });

  const events = await dbCollection
    .find(matchFilter)
    .sort({ time_stamp: 1 })
    .toArray();

  const groupedSessions = groupEventsBySession(events);

  const {
    sessionResults,
    employeeTabTotals,
    employeeSessionCounts
  } = aggregateSessions(groupedSessions, payloadObj, payloadKey);

  const { totalsPerEmployee, averagesPerEmployee } = calculateEmployeeStats(
    employeeTabTotals,
    employeeSessionCounts
  );

  return {
    sessions: sessionResults,
    totals: totalsPerEmployee,
    averages: averagesPerEmployee,
  };
};



export { fetchDataPoolByQueries, sessionFetchByQueries };