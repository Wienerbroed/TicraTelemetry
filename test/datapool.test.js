import { describe, it, expect, vi } from "vitest";

vi.mock("../database/db.js", () => {
  // Example mock data
  const mockEvents = [
    {
      _id: { $oid: "696fc5f967cc1e4bded4499d" },
      application_name: "TICRA Tools",
      event_number: 1,
      event_type: "Create",
      payload: { classname: "cad_aperture", operation: "new menu" },
      session_id: "67279642-9c71-4fea-b0ea-d15543008780",
      time_stamp: "2026-01-20T18:14:17.449Z",
      user_name: "Bianca Webster",
      employee_type: "unknown"
    },
    {
      _id: { $oid: "696fc5f967cc1e4bded4499e" },
      application_name: "TICRA Tools",
      event_number: 2,
      event_type: "Create",
      payload: { classname: "cad_aperture", operation: "new menu" },
      session_id: "67279642-9c71-4fea-b0ea-d15543008780",
      time_stamp: "2026-01-20T18:24:17.449Z",
      user_name: "Bianca Webster",
      employee_type: "unknown"
    },
    {
      _id: { $oid: "696fc5f967cc1e4bded4499f" },
      application_name: "TICRA Tools",
      event_number: 3,
      event_type: "GraspGUI Start",
      payload: { objectsExplorerSelection: "123" },
      session_id: "67279642-9c71-4fea-b0ea-d15543008780",
      time_stamp: "2026-01-20T18:30:17.449Z",
      user_name: "Bianca Webster",
      employee_type: "unknown"
    },
    {
      _id: { $oid: "696fc5f967cc1e4bded4499g" },
      application_name: "TICRA Tools",
      event_number: 4,
      event_type: "GraspGUI Start",
      payload: { objectsExplorerSelection: "123" },
      session_id: "67279642-9c71-4fea-b0ea-d15543008780",
      time_stamp: "2026-01-20T18:40:17.449Z",
      user_name: "Alice Smith",
      employee_type: "unknown"
    }
  ];

  const mockCollection = {
    find: vi.fn(() => mockCollection),
    sort: vi.fn(() => mockCollection),
    toArray: vi.fn(async () => mockEvents)
  };

  return {
    connectDB: vi.fn(async () => ({
      collection: () => mockCollection
    })),
    timeIntervalFilter: vi.fn(() => ({})),
    employeeTypeFilter: vi.fn(() => ({}))
  };
});


import {
  timeSpendByEventType,
  clicksByOperation,
  objectSelectionByGraspGuiStart,
  createClicksByOperation
} from "../database/datapool.js";

describe("datapool functions with mock DB", () => {
  
  it("calculates time spent by event type", async () => {
    const result = await timeSpendByEventType();
    
    // We have two users, Bianca and Alice, two event types
    expect(result.perUser["Bianca Webster"].length).toBeGreaterThan(0);
    expect(result.perUser["Alice Smith"].length).toBeGreaterThan(0);

    const avgCreate = result.averages.find(a => a.event_type === "Create");
    expect(avgCreate).toBeDefined();
    expect(avgCreate.avg_time_spent).toBeGreaterThan(0);
  });

  it("counts clicks by operation", async () => {
  const result = await createClicksByOperation();

  // Check that operations array includes the operation
  expect(result.operations).toContain('"new menu"');

  // Check that perUser has clicks counted correctly
  expect(result.perUser["Bianca Webster"]).toBeDefined();
  const biancaOps = result.perUser["Bianca Webster"];
  const newMenuOp = biancaOps.find(o => o.selection === '"new menu"');
  expect(newMenuOp).toBeDefined();
  expect(newMenuOp.clicks).toBe(2);

  // Check employee type is included
  expect(newMenuOp.employee_type).toBe("unknown");
});


  it("pools object selections for GraspGUI Start", async () => {
    const result = await objectSelectionByGraspGuiStart();

    // Check totals
    expect(result.total[123]).toBe(2);

    // Check average per user
    const userCount = Object.keys(result.rawEvents.reduce((acc, e) => {
      acc[e.user] = true;
      return acc;
    }, {})).length;

    expect(result.average[123]).toBeCloseTo(1, 1); 
  });

});

