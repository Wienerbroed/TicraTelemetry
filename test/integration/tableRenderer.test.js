import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

let app;

// Mock per-user table data
const mockTableData = {
  Alice: { 'event::Op1': 5 },
  Bob: { 'event::Op1': 10 },
};

beforeAll(() => {
  app = express();
  app.use(express.json());

  // Table data route
  app.get('/api/tableData', (req, res) => {
    // Optionally, you could filter based on query params
    const { user } = req.query;
    if (user && mockTableData[user]) {
      res.json({ [user]: mockTableData[user] });
    } else if (user) {
      res.json({});
    } else {
      res.json(mockTableData);
    }
  });
});

afterAll(async () => {
  if (app && app.close) await app.close?.();
});

describe('Table Data API Integration', () => {
  it('should return table data for all users', async () => {
    const res = await request(app).get('/api/tableData').expect(200);
    expect(res.body).toEqual(mockTableData);
  });

  it('should return table data for a single user', async () => {
    const res = await request(app).get('/api/tableData?user=Alice').expect(200);
    expect(res.body).toEqual({ Alice: mockTableData.Alice });
  });

  it('should return empty object for non-existent user', async () => {
    const res = await request(app).get('/api/tableData?user=Charlie').expect(200);
    expect(res.body).toEqual({});
  });
});