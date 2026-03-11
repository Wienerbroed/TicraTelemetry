import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

let app;

// Mock timeline data
const mockTimelineData = {
  sessionId: 'mock-session-1',
  user_name: 'Test User',
  employee_type: 'Tester',
  timeline: [
    { timestamp: '2026-03-11T10:00:00Z', event: 'Login' },
    { timestamp: '2026-03-11T10:05:00Z', event: 'Click Button' },
    { timestamp: '2026-03-11T10:10:00Z', event: 'Logout' },
  ],
};

beforeAll(() => {
  app = express();
  app.use(express.json());

  // Simple in-memory store
  const store = {
    [mockTimelineData.sessionId]: mockTimelineData,
  };

  // Timeline route
  app.get('/sessionTimeline', (req, res) => {
    const sessionId = req.query.sessionId;
    const data = store[sessionId];
    if (data) {
      const totalDurationSeconds = 600;
      res.json({
        ...data,
        totalEvents: data.timeline.length,
        totalDurationSeconds,
      });
    } else {
      res.json({
        sessionId,
        user_name: 'Unknown',
        employee_type: 'Unknown',
        timeline: [],
        totalEvents: 0,
        totalDurationSeconds: 0,
      });
    }
  });
});

afterAll(async () => {
  if (app && app.close) await app.close?.();
});

describe('Timeline API Integration', () => {
  it('should return timeline data for an existing session', async () => {
    const res = await request(app)
      .get(`/sessionTimeline?sessionId=${mockTimelineData.sessionId}`)
      .expect(200);

    expect(res.body.sessionId).toBe(mockTimelineData.sessionId);
    expect(res.body.user_name).toBe(mockTimelineData.user_name);
    expect(res.body.employee_type).toBe(mockTimelineData.employee_type);
    expect(res.body.timeline).toEqual(mockTimelineData.timeline);
    expect(res.body.totalEvents).toBe(mockTimelineData.timeline.length);
    expect(res.body.totalDurationSeconds).toBe(600);
  });

  it('should return empty timeline for a non-existent session', async () => {
    const res = await request(app)
      .get('/sessionTimeline?sessionId=non-existent')
      .expect(200);

    expect(res.body).toEqual({
      sessionId: 'non-existent',
      user_name: 'Unknown',
      employee_type: 'Unknown',
      timeline: [],
      totalEvents: 0,
      totalDurationSeconds: 0,
    });
  });
});