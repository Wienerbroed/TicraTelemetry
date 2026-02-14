import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";


// Mock data
vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");

  return {
    default: {
      ...actual,
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  };
});


// Setup
import fs from "fs/promises";

const TEST_FILE_PATH = path.resolve("test/testConfig/test.json");


// tests
describe("configManager JSON operations", () => {
  let appendJson, updateJson, deleteJson;
  let realFs;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    realFs = await vi.importActual("fs/promises");

    // Reset test file
    await realFs.writeFile(TEST_FILE_PATH, "{}", "utf8");

    // Redirect reads
    fs.readFile.mockImplementation(async () => {
      return realFs.readFile(TEST_FILE_PATH, "utf8");
    });

    // Redirect writes
    fs.writeFile.mockImplementation(async (_path, data) => {
      return realFs.writeFile(TEST_FILE_PATH, data, "utf8");
    });

    const module = await import("../../database/config/configManager.js");

    appendJson = module.appendJson;
    updateJson = module.updateJson;
    deleteJson = module.deleteJson;
  });

  it("should append JSON entry", async () => {
    await appendJson("queries", "testTitle", "LOGIN", "payload.test");

    const content = JSON.parse(
      await realFs.readFile(TEST_FILE_PATH, "utf8")
    );

    const values = Object.values(content);

    expect(values.length).toBe(1);
    expect(values[0].query.event_type).toBe("LOGIN");
  });

  it("should update JSON entry", async () => {
    await appendJson("queries", "oldTitle", "LOGIN", "payload.test");

    await updateJson(
      "queries",
      "oldTitle",
      "newTitle",
      "LOGOUT",
      "payload.new"
    );

    const content = JSON.parse(
      await realFs.readFile(TEST_FILE_PATH, "utf8")
    );

    const values = Object.values(content);

    expect(values.length).toBe(1);
    expect(values[0].query.event_type).toBe("LOGOUT");
  });

  it("should delete JSON entry", async () => {
    await appendJson("queries", "deleteMe", "LOGIN", "payload.test");

    await deleteJson("queries", "deleteMe");

    const content = JSON.parse(
      await realFs.readFile(TEST_FILE_PATH, "utf8")
    );

    expect(Object.keys(content).length).toBe(0);
  });
});
