import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory mock database
let mockConfigs = [];

// Mock DB layer
vi.mock("../../database/db.js", () => ({
  connectConfigDB: vi.fn(async () => ({
    collection: vi.fn(() => ({
      findOne: vi.fn(async (query) => {
        return mockConfigs.find(c => c.title === query.title) || null;
      }),

      insertOne: vi.fn(async (doc) => {
        mockConfigs.push(doc);
        return { insertedId: "mock-id" };
      }),

      find: vi.fn(() => ({
        toArray: vi.fn(async () => mockConfigs)
      })),

      updateOne: vi.fn(async (filter, update) => {
        const index = mockConfigs.findIndex(c => c.title === filter.title);
        if (index === -1) return { matchedCount: 0 };

        mockConfigs[index] = {
          ...mockConfigs[index],
          ...update.$set
        };

        return { matchedCount: 1 };
      }),

      deleteOne: vi.fn(async (filter) => {
        const index = mockConfigs.findIndex(c => c.title === filter.title);
        if (index === -1) return { deletedCount: 0 };

        mockConfigs.splice(index, 1);
        return { deletedCount: 1 };
      })
    }))
  }))
}));

// Import AFTER mock
import {
  createConfig,
  updateConfig,
  deleteConfig,
  listConfigs
} from "../../database/configManager.js";

describe("configManager Mongo operations", () => {

  beforeEach(() => {
    mockConfigs = [];
  });

  it("should create config", async () => {
    await createConfig({
      title: "testTitle",
      mode: "event",
      event_type: "LOGIN",
      payload_field: "payload.test"
    });

    const configs = await listConfigs();

    expect(configs.length).toBe(1);
    expect(configs[0].event_type).toBe("LOGIN");
  });

  it("should update config", async () => {
    await createConfig({
      title: "oldTitle",
      mode: "event",
      event_type: "LOGIN",
      payload_field: "payload.test"
    });

    await updateConfig("oldTitle", {
      title: "newTitle",
      event_type: "LOGOUT",
      payload_field: "payload.new"
    });

    const configs = await listConfigs();

    expect(configs.length).toBe(1);
    expect(configs[0].event_type).toBe("LOGOUT");
  });

  it("should delete config", async () => {
    await createConfig({
      title: "deleteMe",
      mode: "event",
      event_type: "LOGIN",
      payload_field: "payload.test"
    });

    await deleteConfig("deleteMe");

    const configs = await listConfigs();

    expect(configs.length).toBe(0);
  });

});