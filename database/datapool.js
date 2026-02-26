import { connectDB, timeIntervalFilter } from "./db.js";
import { getRawConfig } from "./configManager.js";

const database = await connectDB();
const dbCollection = database.collection("gui_event");

////////////////////////////////////////////////
//////////////// EVENT POOL FETCH //////////////
////////////////////////////////////////////////

const fetchDataPoolByQueries = async ({
  inputEventType,
  startTime,
  endTime,
  employeeType
} = {}) => {
  if (!inputEventType)
    throw new Error("inputEventType (resolved event_type) is required");

  if (!startTime || !endTime)
    throw new Error("startTime and endTime are required");

  const matchFilter = {
    event_type: inputEventType,
    ...timeIntervalFilter(startTime, endTime)
  };

  if (employeeType) {
    if (Array.isArray(employeeType)) {
      matchFilter.employee_type = { $in: employeeType };
    } else {
      matchFilter.employee_type = employeeType;
    }
  }

  const pipeline = [
    { $match: matchFilter },

    // Extract last payload key/value
    {
      $addFields: {
        lastPayloadPair: {
          $cond: [
            {
              $and: [
                { $ne: ["$payload", null] },
                { $eq: [{ $type: "$payload" }, "object"] }
              ]
            },
            { $arrayElemAt: [{ $objectToArray: "$payload" }, -1] },
            null
          ]
        }
      }
    },

    {
      $group: {
        _id: {
          user_name: "$user_name",
          event_type: "$event_type",
          employee_type: "$employee_type",
          payload_value: "$lastPayloadPair.v"
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
        payload: {
          $cond: [
            { $ifNull: ["$_id.payload_value", false] },
            { value: "$_id.payload_value" },
            {}
          ]
        },
        count: 1
      }
    }
  ];

  const events = await dbCollection.aggregate(pipeline).toArray();

  return {
    meta: {
      event_type: inputEventType,
      count: events.length
    },
    events
  };
};

////////////////////////////////////////////////
//////////////// SESSION FETCH //////////////////
////////////////////////////////////////////////

const sessionFetchByQueries = async ({
  configTitle,
  inputEventType,
  startTime,
  endTime,
  user_name,
  employee_type
} = {}) => {
  if (!inputEventType) throw new Error("inputEventType is required");
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  const config = await getRawConfig(configTitle);
  if (!config) throw new Error("Config not found");

  const payloadField = Array.isArray(config.payload_field)
    ? config.payload_field[0]
    : config.payload_field;

  // Build DB query
  const matchFilter = {
    event_type: inputEventType,
    ...timeIntervalFilter(startTime, endTime)
  };
  if (user_name) matchFilter.user_name = user_name;
  if (employee_type) matchFilter.employee_type = employee_type;

  const events = await dbCollection.find(matchFilter).sort({ time_stamp: 1 }).toArray();

  // Group events by session
  const groupedSessions = events.reduce((acc, ev) => {
    const key = ev.session_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

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

      // Extract payload value as string
      let tab = "Unknown";
      if (current.payload && typeof current.payload === "object") {
        const val = current.payload[payloadField];
        if (val !== undefined && val !== null) tab = String(val);
      }

      let currentStart = new Date(current.time_stamp);
      let currentEnd = next && next.session_id === sessionId
        ? new Date(next.time_stamp)
        : new Date(current.time_stamp);

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
        tab,
        start_time: currentStart.toISOString(),
        end_time: currentEnd.toISOString(),
        durationSeconds,
        session_end: !next || next.session_id !== sessionId
      });

      if (!employeeTabTotals[user]) employeeTabTotals[user] = {};
      employeeTabTotals[user][tab] = (employeeTabTotals[user][tab] || 0) + durationSeconds;
    }
  }

  // Calculate totals and averages per employee
  const totalsPerEmployee = {};
  const averagesPerEmployee = {};
  for (const [user, tabTotals] of Object.entries(employeeTabTotals)) {
    totalsPerEmployee[user] = {};
    averagesPerEmployee[user] = {};
    const sessionCount = employeeSessionCounts[user] || 1;

    for (const [tab, total] of Object.entries(tabTotals)) {
      totalsPerEmployee[user][tab] = total;
      averagesPerEmployee[user][tab] = total / sessionCount;
    }
  }

  return {
    sessions: sessionResults,
    totals: totalsPerEmployee,
    averages: averagesPerEmployee
  };
};

////////////////////////////////////////////////
//////////////// SESSION TIMELINE //////////////
////////////////////////////////////////////////

const sessionTimeline = async ({ sessionId }) => {
  if (!sessionId) throw new Error("sessionId is required");

  const events = await dbCollection
    .find({ session_id: sessionId })
    .sort({ event_number: 1 })
    .toArray();

  let totalDurationSeconds = 0;

  const timeline = events.map((current, i) => {
    const next = events[i + 1];

    let durationSeconds = 0;
    if (next) {
      durationSeconds = (new Date(next.time_stamp) - new Date(current.time_stamp)) / 1000;
      totalDurationSeconds += durationSeconds;
    }

    // Extract last payload value only
    let lastPayload = null;
    if (current.payload && typeof current.payload === "object") {
      const entries = Object.entries(current.payload);
      if (entries.length > 0) {
        const [, value] = entries[entries.length - 1];
        // If value is an object with a single key "selected tab", just take its value
        if (value && typeof value === "object" && Object.keys(value).length === 1) {
          lastPayload = Object.values(value)[0];
        } else {
          lastPayload = value;
        }
      }
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
    user_name: events[0]?.user_name || "Unknown",
    employee_type: events[0]?.employee_type || "Unknown",
    totalEvents: events.length,
    totalDurationSeconds,
    timeline
  };
};




export { fetchDataPoolByQueries, sessionFetchByQueries, sessionTimeline };
