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
  if (!inputEventType) throw new Error("inputEventType is required");
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  const data = await readFile(poolConfigPath, "utf-8");
  const config = JSON.parse(data);
  const eventConfig = config[inputEventType];
  if (!eventConfig) throw new Error(`Event type "${inputEventType}" not found in config`);

  const payloadFields = Object.keys(eventConfig.fields).filter(f => f.startsWith("payload."));
  if (payloadFields.length === 0) throw new Error("No payload fields configured for this event");

  const payloadField = payloadFields[0];
  const payloadKey = payloadField.split(".").pop();

  const matchFilter = {
    ...eventConfig.query,
    ...timeIntervalFilter(startTime, endTime),
    ...employeeTypeFilter(employeeType)
  };

  return { payloadField, payloadKey, matchFilter };
};

const getSessionConfig = async (inputEventType) => {
  if (!inputEventType) throw new Error("inputEventType is required");

  const data = await readFile(sessionConfigPath, "utf-8");
  const config = JSON.parse(data);
  const eventConfig = config[inputEventType];
  if (!eventConfig) throw new Error(`Event type "${inputEventType}" not found in session config`);

  const payloadFields = Object.keys(eventConfig.fields).filter(f => f.startsWith("payload."));
  if (payloadFields.length === 0) throw new Error("No payload fields configured for this event");

  const payloadField = payloadFields[0];
  const [payloadObj, payloadKey] = payloadField.split(".");
  return { eventConfig, payloadObj, payloadKey };
};

const buildSessionMatchFilter = ({ eventConfig, startTime, endTime, user_name, employee_type }) => {
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  const matchFilter = {
    ...eventConfig.query,
    ...timeIntervalFilter(startTime, endTime),
  };

  if (user_name) matchFilter.user_name = user_name;
  if (employee_type) matchFilter.employee_type = employee_type;

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

const aggregateSessions = (groupedSessions, payloadObj, payloadKey, startTime, endTime) => {
  const sessionResults = [];
  const employeeTabTotals = {};
  const employeeSessionCounts = {};

  const rangeStart = new Date(startTime);
  const rangeEnd = new Date(endTime);

  for (const sessionEvents of Object.values(groupedSessions)) {
    if (!sessionEvents.length) continue;

    const user = sessionEvents[0].user_name;
    const sessionId = sessionEvents[0].session_id;
    employeeSessionCounts[user] = (employeeSessionCounts[user] || 0) + 1;

    sessionEvents.sort((a, b) => a.event_number - b.event_number);

    for (let i = 0; i < sessionEvents.length; i++) {
      const current = sessionEvents[i];
      const next = sessionEvents[i + 1];

      const currentTab = current[payloadObj]?.[payloadKey] || "Unknown";

      let currentStart = new Date(current.time_stamp);
      let currentEnd = next && next.session_id === sessionId ? new Date(next.time_stamp) : new Date(current.time_stamp);

      // Clamp to query interval
      if (currentEnd < rangeStart) continue;
      if (currentStart > rangeEnd) break;
      if (currentStart < rangeStart) currentStart = rangeStart;
      if (currentEnd > rangeEnd) currentEnd = rangeEnd;

      let durationSeconds = (currentEnd - currentStart) / 1000;
      if (durationSeconds < 0) durationSeconds = 0;

      sessionResults.push({
        user_name: user,
        session_id: sessionId,
        tab: currentTab,
        start_time: currentStart.toISOString(),
        end_time: currentEnd.toISOString(),
        durationSeconds,
        session_end: !next || next.session_id !== sessionId
      });

      if (!employeeTabTotals[user]) employeeTabTotals[user] = {};
      employeeTabTotals[user][currentTab] = (employeeTabTotals[user][currentTab] || 0) + durationSeconds;
    }
  }

  return { sessionResults, employeeTabTotals, employeeSessionCounts };
};

const calculateEmployeeStats = (employeeTabTotals, employeeSessionCounts) => {
  const totalsPerEmployee = {};
  const averagesPerEmployee = {};

  for (const [user, tabTotals] of Object.entries(employeeTabTotals)) {
    totalsPerEmployee[user] = {};
    averagesPerEmployee[user] = {};

    const sessionCount = employeeSessionCounts[user] || 1;

    for (const [tab, totalSeconds] of Object.entries(tabTotals)) {
      totalsPerEmployee[user][tab] = totalSeconds;
      averagesPerEmployee[user][tab] = totalSeconds / sessionCount;
    }
  }

  return { totalsPerEmployee, averagesPerEmployee };
};

//////////////////////////////////////////////// Functions ////////////////////////////////////////////////
const fetchDataPoolByQueries = async ({ inputEventType, startTime, endTime, employeeType } = {}) => {
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  const { payloadField, payloadKey, matchFilter } = await buildEventQueryConfig({ inputEventType, startTime, endTime, employeeType });

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
  return { meta: { inputEventType, count: events.length }, events };
};


//////////////////////////////////////////////// Functions ////////////////////////////////////////////////
const sessionFetchByQueries = async ({ eventType, startTime, endTime, user_name, employee_type } = {}) => {
  if (!eventType) throw new Error("eventType is required");
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  // Get session config
  const { eventConfig, payloadObj, payloadKey } = await getSessionConfig(eventType);

  // Build DB query
  const matchFilter = buildSessionMatchFilter({
    eventConfig,
    startTime,
    endTime,
    user_name,
    employee_type
  });

  // Fetch events from DB
  const events = await dbCollection
    .find(matchFilter)
    .sort({ time_stamp: 1 })
    .toArray();

  // Group events by session
  const groupedSessions = groupEventsBySession(events);

  // Use aggregateSessions helper to handle clamping, totals, averages
  const { sessionResults, employeeTabTotals, employeeSessionCounts } =
    aggregateSessions(groupedSessions, payloadObj, payloadKey, startTime, endTime);

  // Calculate per-employee stats
  const { totalsPerEmployee, averagesPerEmployee } =
    calculateEmployeeStats(employeeTabTotals, employeeSessionCounts);

  return {
    sessions: sessionResults,
    totals: totalsPerEmployee,
    averages: averagesPerEmployee
  };
};


const sessionTimeline = async ({ sessionId, startTime, endTime } = {}) => {
  if (!sessionId) throw new Error("Session id required");
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  const rangeStart = new Date(startTime);
  const rangeEnd = new Date(endTime);

  const events = await dbCollection
    .find({ session_id: sessionId, ...timeIntervalFilter(startTime, endTime) })
    .sort({ event_number: 1 })
    .toArray();

  if (!events.length) return { sessionId, totalEvents: 0, timeline: [] };

  let totalDurationSeconds = 0;

  const timeline = events.map((current, i) => {
    const next = events[i + 1];

    let durationSeconds = 0;
    if (next) {
      durationSeconds = (new Date(next.time_stamp) - new Date(current.time_stamp)) / 1000;
      totalDurationSeconds += durationSeconds;
    }

    let lastPayload = null;
    if (current.payload && typeof current.payload === "object") {
      const keys = Object.keys(current.payload);
      if (keys.length) lastPayload = { [keys[keys.length - 1]]: current.payload[keys[keys.length - 1]] };
    }

    return {
      event_number: current.event_number,
      event_type: current.event_type,
      payload: lastPayload,
      time_stamp: current.time_stamp,
      durationSeconds,
      isLastEvent: !next
    };
  });

  return {
    sessionId,
    user_name: events[0].user_name,
    employee_type: events[0].employee_type,
    totalEvents: events.length,
    totalDurationSeconds,
    timeline
  };
};

export { fetchDataPoolByQueries, sessionFetchByQueries, sessionTimeline };