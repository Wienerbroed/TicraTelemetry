import { vi, describe, it, expect } from "vitest";

// Mock data and calls
vi.mock("fs/promises", () => ({
  readFile: vi.fn(async () =>
    JSON.stringify({
      GraspGuiStartExplorerSelection: {},
      CreateEvents: {},
      ToggleEditorEvents: {},
      ExplorerEvents: {},
      GraspGuiStartAppTitle: {}
    })
  )
}));


vi.mock("../database/db.js", () => ({
  connectDB: vi.fn(async () => ({
    collection: vi.fn()
  }))
}));


import { getEventQueries } from "../database/eventQueries.js";

describe("getEventQueries", () => {
  it("returns event types from queries config", async () => {
    const result = await getEventQueries();
    expect(result).toEqual([
      "GraspGuiStartExplorerSelection",
      "CreateEvents",
      "ToggleEditorEvents",
      "ExplorerEvents",
      "GraspGuiStartAppTitle"
    ]);
  });
});

