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
import { getEventType } from '../database/eventTypes.js';

// getEventType test
describe('getEventType', () => {
  it('returns event types from mocked DB', async () => {
    
    // runs getEventType
    const result = await getEventType();

    // Expected result
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
