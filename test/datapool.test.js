// test/datapool.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";

// ----------------- MOCKS -----------------

const mockAggregatedEvents = [
  {
    user_name: "Bianca Webster",
    event_type: "Create",
    employee_type: "unknown",
    payload: { classname: "cad_aperture" },
    count: 2
  },
  {
    user_name: "Alice Smith",
    event_type: "GraspGUI Start",
    employee_type: "unknown",
    payload: { objectsExplorerSelection: "123" },
    count: 1
  }
];

const mockSessionEvents = [
  {
    user_name: "Bianca Webster",
    session_id: "s1",
    time_stamp: "2026-02-11T10:00:00Z",
    payload: { tab: "TabA" }
  },
  {
    user_name: "Bianca Webster",
    session_id: "s1",
    time_stamp: "2026-02-11T10:05:00Z",
    payload: { tab: "TabA" }
  },
  {
    user_name: "Alice Smith",
    session_id: "s2",
    time_stamp: "2026-02-11T11:00:00Z",
    payload: { tab: "TabB" }
  }
];

vi.mock("../database/db.js", () => {
  const mockCollection = {
    aggregate: vi.fn((pipeline) => {
      const matchStage = pipeline.find(stage => stage.$match)?.$match;
      const filteredEvents = mockAggregatedEvents.filter(
        e => !matchStage.event_type || e.event_type === matchStage.event_type
      );
      return { toArray: vi.fn(async () => filteredEvents) };
    }),
    find: vi.fn((filter) => {
      const filtered = mockSessionEvents.filter(
        e => !filter.user_name || e.user_name === filter.user_name
      ).sort((a, b) => new Date(a.time_stamp) - new Date(b.time_stamp));
      return { sort: () => ({ toArray: vi.fn(async () => filtered) }) };
    })
  };

  return {
    dbCollection: mockCollection,
    timeIntervalFilter: vi.fn(() => ({})),
    employeeTypeFilter: vi.fn(() => ({}))
  };
});

vi.mock("fs/promises", () => ({
  readFile: vi.fn(async (path) => {
    if (path.includes("pool")) {
      return JSON.stringify({
        Create: {
          query: { event_type: "Create" },
          fields: { "payload.classname": true }
        },
        "GraspGUI Start": {
          query: { event_type: "GraspGUI Start" },
          fields: { "payload.objectsExplorerSelection": true }
        }
      });
    } else if (path.includes("session")) {
      return JSON.stringify({
        TabpageSessions: {
          query: {},
          fields: { "payload.tab": true }
        }
      });
    }
  })
}));

// ----------------- IMPORTS -----------------
import { dbCollection } from "../database/db.js";
import { readFile } from "fs/promises";

// ----------------- FUNCTIONS UNDER TEST -----------------

const fetchDataPoolByQueries = async ({ inputEventType, startTime, endTime, employeeType } = {}) => {
  if (!inputEventType) throw new Error("inputEventType is required");

  const data = await readFile("poolConfig.json", "utf-8");
  const config = JSON.parse(data);

  const eventConfig = config[inputEventType];
  if (!eventConfig) throw new Error(`Event type "${inputEventType}" not found in config`);

  const payloadFields = Object.keys(eventConfig.fields).filter(f => f.startsWith("payload."));
  if (payloadFields.length === 0) throw new Error("No payload fields configured for this event");

  const payloadField = payloadFields[0];
  const payloadKey = payloadField.split(".").pop();

  const matchFilter = {
    ...eventConfig.query
  };

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
};

const sessionFetchByQueries = async ({ startTime, endTime, user_name } = {}) => {
  const data = await readFile("sessionConfig.json", "utf-8");
  const config = JSON.parse(data);
  const eventConfig = config["TabpageSessions"];

  const payloadFields = Object.keys(eventConfig.fields).filter(f => f.startsWith("payload."));
  const payloadField = payloadFields[0];
  const [payloadObj, payloadKey] = payloadField.split(".");

  const matchFilter = {};
  if (user_name) matchFilter.user_name = user_name;

  const events = await dbCollection.find(matchFilter).sort({ time_stamp: 1 }).toArray();

  const groupedSessions = {};
  for (const event of events) {
    const key = `${event.user_name}_${event.session_id}`;
    if (!groupedSessions[key]) groupedSessions[key] = [];
    groupedSessions[key].push(event);
  }

  const sessionResults = [];
  const employeeTabTotals = {};
  const employeeSessionCounts = {};

  for (const [sessionKey, sessionEvents] of Object.entries(groupedSessions)) {
    if (!sessionEvents.length) continue;
    const user = sessionEvents[0].user_name;
    const sessionId = sessionEvents[0].session_id;

    employeeSessionCounts[user] = (employeeSessionCounts[user] || 0) + 1;

    const tabAggregation = {};

    for (let i = 0; i < sessionEvents.length; i++) {
      const current = sessionEvents[i];
      const next = sessionEvents[i + 1];
      const currentTab = current?.[payloadObj]?.[payloadKey] || "Unknown";
      let durationSeconds = 0;
      if (next && next.session_id === current.session_id && next.user_name === current.user_name) {
        durationSeconds = (new Date(next.time_stamp) - new Date(current.time_stamp)) / 1000;
      }
      if (!tabAggregation[currentTab]) {
        tabAggregation[currentTab] = {
          user_name: user,
          session_id: sessionId,
          tab: currentTab,
          start_time: current.time_stamp,
          end_time: next ? next.time_stamp : current.time_stamp,
          durationSeconds: 0,
          session_end: false
        };
      }
      tabAggregation[currentTab].durationSeconds += durationSeconds;
      if (!next) tabAggregation[currentTab].session_end = true;
    }

    for (const tabData of Object.values(tabAggregation)) {
      sessionResults.push(tabData);
      if (!employeeTabTotals[user]) employeeTabTotals[user] = {};
      if (!employeeTabTotals[user][tabData.tab]) employeeTabTotals[user][tabData.tab] = 0;
      employeeTabTotals[user][tabData.tab] += tabData.durationSeconds;
    }
  }

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

  return {
    sessions: sessionResults,
    totals: totalsPerEmployee,
    averages: averagesPerEmployee
  };
};

// ----------------- TESTS -----------------

describe("fetchDataPoolByQueries", () => {
  it("returns aggregated events for 'Create'", async () => {
    const result = await fetchDataPoolByQueries({ inputEventType: "Create" });
    expect(result.meta.inputEventType).toBe("Create");
    expect(result.events[0].user_name).toBe("Bianca Webster");
    expect(result.events[0].payload.classname).toBe("cad_aperture");
    expect(result.events[0].count).toBe(2);
  });

  it("returns aggregated events for 'GraspGUI Start'", async () => {
    const result = await fetchDataPoolByQueries({ inputEventType: "GraspGUI Start" });
    expect(result.meta.inputEventType).toBe("GraspGUI Start");
    expect(result.events[0].user_name).toBe("Alice Smith");
    expect(result.events[0].payload.objectsExplorerSelection).toBe("123");
    expect(result.events[0].count).toBe(1);
  });
});

describe("sessionFetchByQueries", () => {
  it("aggregates session events and calculates durations", async () => {
    const result = await sessionFetchByQueries();
    expect(result.sessions).toHaveLength(2);
    
    expect(result.totals["Bianca Webster"]["TabA"]).toBe(300); 
    
    expect(result.averages["Bianca Webster"]["TabA"]).toBe(300); 
    
    expect(result.totals["Alice Smith"]["TabB"]).toBe(0);
  });

  it("filters by user_name", async () => {
    const result = await sessionFetchByQueries({ user_name: "Alice Smith" });
    expect(Object.keys(result.totals)).toEqual(["Alice Smith"]);
    expect(result.sessions[0].user_name).toBe("Alice Smith");
  });
});
