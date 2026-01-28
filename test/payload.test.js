import { vi, describe, it, expect } from 'vitest';

// Mock connectDB BEFORE importing the module
vi.mock('../database/db.js', () => ({
  connectDB: async () => ({
    collection: () => ({
      // Mock for getPayload()
      distinct: async () => [101, 102, 103],

      // Mock for payloadByEventType()
      aggregate: () => ({
        toArray: async () => [
          {
            event_type: "Create",
            payloads: [
              { payload: { foo: 1 }, count: 2 },
              { payload: { bar: 2 }, count: 1 }
            ]
          },
          {
            event_type: "3D View",
            payloads: [
              { payload: { baz: 3 }, count: 5 }
            ]
          }
        ]
      })
    })
  })
}));

// Import production code
import { getPayload, payloadByEventType } from '../database/payload.js';

describe('getPayload', () => {
  it('returns unique payload numbers from mocked DB', async () => {
    const result = await getPayload();
    expect(result).toEqual([101, 102, 103]);
  });
});

describe('payloadByEventType', () => {
  it('returns payloads grouped by event type', async () => {
    const result = await payloadByEventType();
    expect(result).toEqual([
      {
        event_type: "Create",
        payloads: [
          { payload: { foo: 1 }, count: 2 },
          { payload: { bar: 2 }, count: 1 }
        ]
      },
      {
        event_type: "3D View",
        payloads: [
          { payload: { baz: 3 }, count: 5 }
        ]
      }
    ]);
  });
});
