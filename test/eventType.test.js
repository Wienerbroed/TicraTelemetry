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
    collection: vi.fn(() => ({
      distinct: vi.fn(async () => [
        "3D View",
        "Create",
        "Explorer",
        "GraspGUI End",
        "GraspGUI Start",
        "Object Tree",
        "Results",
        "SplashScreenWizard",
        "Tabpage",
        "Toggle Editor"
      ])
    }))
  }))
}));


import { getEventType } from "../database/eventTypes.js";


// Tests
describe("getEventType", () => {
  it("returns event types from queries config", async () => {
    const result = await getEventType();

    expect(result).toEqual([
      "3D View",
      "Create",
      "Explorer",
      "GraspGUI End",
      "GraspGUI Start",
      "Object Tree",
      "Results",
      "SplashScreenWizard",
      "Tabpage",
      "Toggle Editor"
    ]);
  });
});
