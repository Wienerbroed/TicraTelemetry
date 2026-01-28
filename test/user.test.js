import { vi, describe, it, expect } from 'vitest';

// Mock connectDB BEFORE importing the module
vi.mock('../database/db.js', () => ({
  connectDB: async () => ({
    collection: () => ({
      // Mock distinct for getUsers()
      distinct: async () => ['Alice', 'Bob', 'Charlie'],

      // Mock find().toArray() for userInteractionCount()
      find: () => ({
        toArray: async () => [
          { user_name: 'Alice' },
          { user_name: 'Bob' },
          { user_name: 'Alice' },
          { user_name: 'Charlie' }
        ]
      }),

      // Mock aggregate().toArray() for actionsByUsers()
      aggregate: () => ({
        toArray: async () => [
          {
            event_type: 'Create',
            payloads: [
              { payload: { action: 'click' }, count: 2 },
              { payload: { action: 'drag' }, count: 1 }
            ]
          },
          {
            event_type: '3D View',
            payloads: [
              { payload: { action: 'rotate' }, count: 3 }
            ]
          }
        ]
      })
    })
  })
}));

// Import production code
import { getUsers, userInteractionCount, actionsByUsers } from '../database/user.js';

describe('getUsers', () => {
  it('returns unique users from the mocked DB', async () => {
    const result = await getUsers();
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});

describe('userInteractionCount', () => {
  it('counts user interactions correctly', async () => {
    const result = await userInteractionCount();
    expect(result).toEqual({
      Alice: 2,
      Bob: 1,
      Charlie: 1
    });
  });
});

describe('actionsByUsers', () => {
  it('returns payloads grouped by user', async () => {
    const result = await actionsByUsers();
    expect(result).toEqual([
      {
        event_type: 'Create',
        payloads: [
          { payload: { action: 'click' }, count: 2 },
          { payload: { action: 'drag' }, count: 1 }
        ]
      },
      {
        event_type: '3D View',
        payloads: [
          { payload: { action: 'rotate' }, count: 3 }
        ]
      }
    ]);
  });
});
