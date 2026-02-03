import { describe, it, expect, beforeEach } from "vitest";
import { createMockDb } from "../mocks/mockDb.js";
import { mockEvents } from "../mocks/mockData.js";

let dbCollection;

// ------------------- functions -------------------

export const timeSpendByEventType = async () => {
  const events = await dbCollection
    .find({ user_name: { $exists: true } })
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
      if (nextTime > currTime && next.event_number >= curr.event_number) {
        time_spent = (nextTime - currTime) / 60000;
      }
    }

    const eventType = curr.event_type ?? "unknown";
    const user = curr.user_name;

    if (!perUser[user]) perUser[user] = [];
    perUser[user].push({ event_type: eventType, time_spent });

    if (!pooled[eventType]) pooled[eventType] = { total_time: 0, users: new Set() };
    pooled[eventType].total_time += time_spent;
    pooled[eventType].users.add(user);
  }

  const averages = Object.entries(pooled).map(([event_type, data]) => ({
    event_type,
    avg_time_spent: data.users.size === 0 ? 0 : data.total_time / data.users.size
  }));

  return { perUser, averages };
};

const formatSelectionLabel = v => v;
const timeIntervalFilter = () => ({});
const employeeTypeFilter = () => ({});

export const clicksByOperation = async () => {
  const rawEvents = await dbCollection.find({ event_type: "Create" }).toArray();

  const perUser = {};
  const operationSet = new Set();
  const employeeTypeSet = new Set();

  rawEvents.forEach(doc => {
    const user = doc.user_name ?? "unknown";
    const op = formatSelectionLabel(doc.payload.operation);
    const type = doc.employee_type ?? "unknown";

    operationSet.add(op);
    employeeTypeSet.add(type);

    if (!perUser[user]) perUser[user] = [];
    const existing = perUser[user].find(s => s.selection === op);
    if (existing) existing.clicks += 1;
    else perUser[user].push({ selection: op, clicks: 1, employee_type: type });
  });

  const operations = Array.from(operationSet).sort();
  const employeeTypes = Array.from(employeeTypeSet).sort();

  const totals = {};
  operations.forEach(op => {
    totals[op] = Object.values(perUser).reduce((sum, userOps) => {
      const obj = userOps.find(s => s.selection === op);
      return sum + (obj ? obj.clicks : 0);
    }, 0);
  });

  const averages = {};
  operations.forEach(op => {
    averages[op] = Object.keys(perUser).length ? parseFloat((totals[op] / Object.keys(perUser).length).toFixed(2)) : 0;
  });

  return { perUser, operations, totals, averages, employeeTypes, rawEvents };
};

export const objectSelectionByGraspGuiStart = async () => {
  const selections = await dbCollection.find({ event_type: "GraspGUI Start" }).toArray();

  const rawEvents = selections.map(doc => {
    let sel = doc.payload.objectsExplorerSelection;
    if (sel === null || sel === undefined) sel = null;
    else if (!isNaN(sel)) sel = Number(sel);
    else sel = String(sel);

    return {
      user: doc.user_name ?? "unknown",
      employee_type: doc.employee_type ?? "unknown",
      selection: sel,
      time_stamp: doc.time_stamp
    };
  });

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
};

// ------------------- tests -------------------

describe("analytics functions with mock db", () => {
  beforeEach(() => {
    dbCollection = createMockDb(mockEvents);
  });

  it("timeSpendByEventType returns correct per-user and averages", async () => {
    const result = await timeSpendByEventType();

    const adrianTimes = result.perUser["Adrian Hobson"].map(e => e.time_spent);
    expect(adrianTimes.length).toBe(3); // number of events
    expect(adrianTimes[0]).toBeCloseTo(1.05, 5); // minutes between 1st & 2nd
    expect(adrianTimes[1]).toBeCloseTo(2.5, 5);  // minutes between 2nd & 3rd
    expect(adrianTimes[2]).toBe(0);              // last event has no next

    const createAverage = result.averages.find(a => a.event_type === "Create").avg_time_spent;
    expect(createAverage).toBeCloseTo(3.55, 5);  // updated
    });

  it("clicksByOperation returns correct counts and totals", async () => {
    const result = await clicksByOperation();

    // Only Adrian Hobson has two Create events
    expect(result.operations.sort()).toEqual(["edit menu", "new menu"]);
    expect(result.totals).toEqual({ "edit menu": 1, "new menu": 1 });
    expect(result.averages).toEqual({ "edit menu": 1, "new menu": 1 }); // one user
    expect(result.perUser["Adrian Hobson"].map(e => e.clicks).reduce((a,b)=>a+b,0)).toBe(2);
  });

  it("objectSelectionByGraspGuiStart returns correct totals and averages", async () => {
    const result = await objectSelectionByGraspGuiStart();

    expect(result.rawEvents[0].selection).toBe("elementA");
    expect(result.total).toEqual({ elementA: 1 });
    expect(result.average).toEqual({ elementA: 1 }); // only 1 user
  });
});
