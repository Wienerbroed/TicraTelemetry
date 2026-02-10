import { describe, it, expect, vi } from "vitest";

// Mock data and calls
vi.mock("../database/db.js", () => {
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

  const mockCollection = {
    aggregate: vi.fn(() => ({
      toArray: vi.fn(async () => mockAggregatedEvents)
    }))
  };

  return {
    connectDB: vi.fn(async () => ({
      collection: vi.fn(() => mockCollection)
    })),
    timeIntervalFilter: vi.fn(() => ({})),
    employeeTypeFilter: vi.fn(() => ({}))
  };
});


vi.mock("fs/promises", () => ({
  readFile: vi.fn(async () =>
    JSON.stringify({
      Create: {
        query: { event_type: "Create" },
        fields: {
          "payload.classname": true
        }
      },
      "GraspGUI Start": {
        query: { event_type: "GraspGUI Start" },
        fields: {
          "payload.objectsExplorerSelection": true
        }
      }
    })
  )
}));


import { fetchDataPoolByQueries } from "../database/datapool.js";

// Tests
describe("fetchDataPoolByQueries", () => {
  it("returns aggregated events for a valid event type", async () => {
    const result = await fetchDataPoolByQueries({
      inputEventType: "Create"
    });

    expect(result).toEqual({
      meta: {
        inputEventType: "Create",
        count: 2
      },
      events: [
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
      ]
    });
  });
});
