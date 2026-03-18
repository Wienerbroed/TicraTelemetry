import { connectDB, timeIntervalFilter } from "./db.js";
import { getRawConfig } from "./configManager.js";

const database = await connectDB();
const dbCollection = database.collection("gui_event");

/////////////////////// UTILITY FUNCTIONS ///////////////////////

const extractLastPayloadValue = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const entries = Object.entries(payload);
  if (!entries.length) return null;

  const [, value] = entries[entries.length - 1];
  if (value && typeof value === "object" && Object.keys(value).length === 1) {
    return Object.values(value)[0];
  }
  return value;
};

const clampToInterval = (start, end, rangeStart, rangeEnd) => {
  const clampedStart = start < rangeStart ? rangeStart : start;
  const clampedEnd = end > rangeEnd ? rangeEnd : end;
  return [clampedStart, clampedEnd];
};

const groupBy = (array, keyFn) =>
  array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

/////////////////////// FETCH DATA POOL ///////////////////////

const buildDataPoolPipeline = ({ inputEventType, startTime, endTime, employeeType }) => {
  const matchFilter = {
    event_type: inputEventType,
    ...timeIntervalFilter(startTime, endTime),
  };

  if (employeeType) {
    matchFilter.employee_type = Array.isArray(employeeType)
      ? { $in: employeeType }
      : employeeType;
  }

  return [
    { $match: matchFilter },
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
};

const fetchDataPoolByQueries = async ({ inputEventType, startTime, endTime, employeeType } = {}) => {
  if (!inputEventType) throw new Error("inputEventType is required");
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  const pipeline = buildDataPoolPipeline({ inputEventType, startTime, endTime, employeeType });
  const events = await dbCollection.aggregate(pipeline).toArray();

  return { meta: { event_type: inputEventType, count: events.length }, events };
};

/////////////////////// SESSION FETCH ///////////////////////

const processSessionEventsForTable = (events, payloadField, rangeStart, rangeEnd) => {
  const sessions = [];
  const employeeTabTotals = {};
  const employeeSessionCounts = {};

  const groupedSessions = groupBy(events, ev => ev.session_id);

  for (const sessionEvents of Object.values(groupedSessions)) {
    if (!sessionEvents.length) continue;

    const user = sessionEvents[0].user_name;
    const sessionId = sessionEvents[0].session_id;

    employeeSessionCounts[user] = (employeeSessionCounts[user] || 0) + 1;

    // sort ALL events (important)
    sessionEvents.sort((a, b) => a.event_number - b.event_number);

    const lastEventTime = new Date(
      sessionEvents[sessionEvents.length - 1].time_stamp
    );

    // ONLY Tabpage drives rows (same as timeline)
    const tabEvents = sessionEvents.filter(ev => ev.event_type === "Tabpage");

    for (let i = 0; i < tabEvents.length; i++) {
      const current = tabEvents[i];
      const nextTab = tabEvents[i + 1];

      let tab = "Unknown";
      if (current.payload && typeof current.payload === "object") {
        const val = current.payload[payloadField];
        if (val !== undefined && val !== null) {
          tab = String(val);
        }
      }

      let startTime = new Date(current.time_stamp);
      let endTime;

      // ✅ EXACT SAME RULES AS TIMELINE
      if (nextTab) {
        endTime = new Date(nextTab.time_stamp);
      } else if (sessionEvents.length > 1) {
        endTime = lastEventTime;
      } else {
        endTime = new Date(startTime.getTime() + 1000);
      }

      [startTime, endTime] = clampToInterval(startTime, endTime, rangeStart, rangeEnd);

      const durationSeconds = Math.max((endTime - startTime) / 1000, 0);

      sessions.push({
        user_name: user,
        session_id: sessionId,
        tab,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        durationSeconds,
        session_end: i === tabEvents.length - 1
      });

      if (!employeeTabTotals[user]) employeeTabTotals[user] = {};
      employeeTabTotals[user][tab] =
        (employeeTabTotals[user][tab] || 0) + durationSeconds;
    }
  }

  const totals = {};
  const averages = {};

  for (const [user, tabTotals] of Object.entries(employeeTabTotals)) {
    totals[user] = {};
    averages[user] = {};

    const sessionCount = employeeSessionCounts[user] || 1;

    for (const [tab, total] of Object.entries(tabTotals)) {
      totals[user][tab] = total;
      averages[user][tab] = total / sessionCount;
    }
  }

  return { sessions, totals, averages };
};

const sessionFetchByQueries = async ({
  configTitle,
  inputEventType,
  startTime,
  endTime,
  user_name,
  employee_type
} = {}) => {
  if (!startTime || !endTime) throw new Error("startTime and endTime are required");

  const config = await getRawConfig(configTitle);
  if (!config) throw new Error("Config not found");

  const payloadField = Array.isArray(config.payload_field)
    ? config.payload_field[0]
    : config.payload_field;

  // ✅ FIX: REMOVE event_type filter → get full session like timeline
  const matchFilter = {
    ...timeIntervalFilter(startTime, endTime)
  };

  if (user_name) matchFilter.user_name = user_name;
  if (employee_type) matchFilter.employee_type = employee_type;

  const events = await dbCollection
    .find(matchFilter)
    .sort({ time_stamp: 1 })
    .toArray();

  const rangeStart = new Date(startTime);
  const rangeEnd = new Date(endTime);

  return processSessionEventsForTable(events, payloadField, rangeStart, rangeEnd);
};

/////////////////////// SESSION TIMELINE ///////////////////////

const sessionTimeline = async ({ sessionId }) => {
  if (!sessionId) throw new Error("sessionId is required");

  const events = await dbCollection
    .find({ session_id: sessionId })
    .sort({ event_number: 1 })
    .toArray();

  if (!events.length) {
    return {
      sessionId,
      user_name: "Unknown",
      employee_type: "Unknown",
      totalEvents: 0,
      totalDurationSeconds: 0,
      timeline: []
    };
  }

  const firstTime = new Date(events[0].time_stamp);
  const lastTime = new Date(events[events.length - 1].time_stamp);
  const totalDurationSeconds = Math.max((lastTime - firstTime) / 1000, 1);

  const timeline = events.map((current, i) => {
    const nextTab = events.slice(i + 1).find(ev => ev.event_type === "Tabpage");

    let durationSeconds = 0;
    let associatedTabEventNumber = null;

    if (current.event_type === "Tabpage") {
      if (nextTab) {
        durationSeconds =
          (new Date(nextTab.time_stamp) - new Date(current.time_stamp)) / 1000;
      } else if (i < events.length - 1) {
        durationSeconds =
          (new Date(events[events.length - 1].time_stamp) - new Date(current.time_stamp)) / 1000;
      } else {
        durationSeconds = 1;
      }

      associatedTabEventNumber = current.event_number;
    } else {
      associatedTabEventNumber =
        events.slice(0, i + 1)
          .reverse()
          .find(ev => ev.event_type === "Tabpage")?.event_number ?? null;
    }

    return {
      event_number: current.event_number,
      event_type: current.event_type,
      payload: extractLastPayloadValue(current.payload),
      time_stamp: current.time_stamp,
      durationSeconds,
      associatedTabEventNumber,
      isLastEvent: false
    };
  });

  if (timeline.length) {
    timeline[timeline.length - 1].isLastEvent = true;
  }

  return {
    sessionId,
    user_name: events[0].user_name || "Unknown",
    employee_type: events[0].employee_type || "Unknown",
    totalEvents: events.length,
    totalDurationSeconds,
    timeline
  };
};

export {
  fetchDataPoolByQueries,
  sessionFetchByQueries,
  sessionTimeline
};