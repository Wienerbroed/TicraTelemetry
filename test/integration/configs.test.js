import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

let app;

// Mock configs data
const mockConfigsData = {
  event: {
    description: 'Test Event',
    extra_query: { image: 'http://example.com/image.png' },
  },
};

beforeAll(() => {
  app = express();
  app.use(express.json());

  // Simple in-memory store
  const store = {
    configs: mockConfigsData,
  };

  // Configs route
  app.get('/api/configs/:eventType', (req, res) => {
    const eventType = req.params.eventType;
    const data = store.configs[eventType];
    res.json(data || null);
  });
});

afterAll(async () => {
  if (app && app.close) await app.close?.();
});

describe('Configs API Integration', () => {
  it('should return config JSON for existing event type', async () => {
    const res = await request(app)
      .get('/api/configs/event')
      .expect(200);

    expect(res.body).toEqual(mockConfigsData.event);
  });

  it('should return null for non-existent event type', async () => {
    const res = await request(app)
      .get('/api/configs/nonexistent-event')
      .expect(200);

    expect(res.body).toBeNull();
  });
});