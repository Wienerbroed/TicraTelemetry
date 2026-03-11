import { vi, describe, it, expect } from "vitest";

vi.mock("../database/db.js", () => ({
  connectConfigDB: vi.fn(async () => ({
    collection: vi.fn(() => ({
      find: vi.fn(() => ({
        toArray: vi.fn(async () => [
          { title: "GraspGuiStartExplorerSelection" },
          { title: "CreateEvents" },
          { title: "ToggleEditorEvents" },
          { title: "ExplorerEvents" },
          { title: "GraspGuiStartAppTitle" }
        ])
      }))
    }))
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
