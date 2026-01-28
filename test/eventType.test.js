import { vi, describe, it, expect } from 'vitest';

// Mock the database before importing eventTypes.js
vi.mock('../database/db.js', () => ({
  connectDB: async () => ({
    collection: () => ({
      distinct: async () => [
        "3D View",
        "Create",
        "GraspGUI End",
        "GraspGUI Start",
        "Object Tree",
        "Results",
        "SplashScreenWizard",
        "Tabpage",
        "Toggle Editor"
      ],
      find: () => ({
        toArray: async () => [
          { event_type: "3D View" },
          { event_type: "Create" },
          { event_type: "Create" }
        ]
      })
    })
  })
}));

// Production code import
import { getEventType, countEventTypes } from '../database/eventTypes.js';

describe('getEventType', () => {
  it('returns event types from mocked DB', async () => {
    const result = await getEventType();
    expect(result).toEqual([
      "3D View",
      "Create",
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

describe('countEventTypes', () => {
  it('counts event types correctly', async () => {
    const result = await countEventTypes();
    expect(result).toEqual({
      "3D View": 1,
      "Create": 2,
      "GraspGUI End": 0,
      "GraspGUI Start": 0,
      "Object Tree": 0,
      "Results": 0,
      "SplashScreenWizard": 0,
      "Tabpage": 0,
      "Toggle Editor": 0
    });
  });
});
