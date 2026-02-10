import { vi, describe, it, expect } from 'vitest';

// Mock data and calls
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


import { getUsers, } from '../database/user.js';


//tests
describe('getUsers', () => {
  it('returns unique users from the mocked DB', async () => {
    
    // runs getUsers
    const result = await getUsers();
    // Expected outcome
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});

