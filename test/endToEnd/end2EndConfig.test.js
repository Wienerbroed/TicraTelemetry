// test/endToEnd/fullAppHtml.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import bodyParser from "body-parser";
import { JSDOM } from "jsdom";

// ----------------- MOCK DATABASES -----------------
const mockEventsDB = [
  { user_name: "Bianca Webster", event_type: "Create", employee_type: "unknown", payload: { classname: "cad_aperture" }, count: 2 },
  { user_name: "Alice Smith", event_type: "GraspGUI Start", employee_type: "unknown", payload: { objectsExplorerSelection: "123" }, count: 1 }
];

const mockConfigDB = [
  { user_name: "Bianca Webster", session_id: "s1", time_stamp: "2026-02-11T10:00:00Z", payload: { tab: "TabA" } },
  { user_name: "Bianca Webster", session_id: "s1", time_stamp: "2026-02-11T10:05:00Z", payload: { tab: "TabA" } },
  { user_name: "Alice Smith", session_id: "s2", time_stamp: "2026-02-11T11:00:00Z", payload: { tab: "TabB" } }
];

// ----------------- MOCK FS -----------------
vi.mock("fs/promises", () => ({
  readFile: vi.fn(async (path) => {
    if (path.includes("pool")) {
      return JSON.stringify({
        Create: { query: { event_type: "Create" }, fields: { "payload.classname": true } },
        "GraspGUI Start": { query: { event_type: "GraspGUI Start" }, fields: { "payload.objectsExplorerSelection": true } }
      });
    } else if (path.includes("session")) {
      return JSON.stringify({
        TabpageSessions: { query: {}, fields: { "payload.tab": true } }
      });
    }
  })
}));

import { readFile } from "fs/promises";

// ----------------- UTILS -----------------
const fetchDataPoolByQueries = async ({ inputEventType }) => {
  if (!inputEventType) throw new Error("inputEventType required");
  const config = JSON.parse(await readFile("poolConfig.json", "utf-8"));
  const eventConfig = config[inputEventType];
  const payloadField = Object.keys(eventConfig.fields)[0];
  const payloadKey = payloadField.split(".").pop();

  const events = mockEventsDB.filter(e => e.event_type === eventConfig.query.event_type)
    .map(e => ({ user_name: e.user_name, event_type: e.event_type, payload: { [payloadKey]: e.payload[payloadKey] }, count: e.count }));

  return { meta: { inputEventType, count: events.length }, events };
};

const sessionFetchByQueries = async ({ user_name } = {}) => {
  const config = JSON.parse(await readFile("sessionConfig.json", "utf-8"));
  const payloadField = Object.keys(config.TabpageSessions.fields)[0];
  const [payloadObj, payloadKey] = payloadField.split(".");

  const events = mockConfigDB
    .filter(e => !user_name || e.user_name === user_name)
    .sort((a, b) => new Date(a.time_stamp) - new Date(b.time_stamp));

  const groupedSessions = {};
  events.forEach(e => {
    const key = `${e.user_name}_${e.session_id}`;
    if (!groupedSessions[key]) groupedSessions[key] = [];
    groupedSessions[key].push(e);
  });

  const sessionResults = [];
  const totals = {};
  const averages = {};

  for (const [_, sessionEvents] of Object.entries(groupedSessions)) {
    const user = sessionEvents[0].user_name;
    totals[user] = totals[user] || {};
    averages[user] = averages[user] || {};
    let prevTime = null;

    sessionEvents.forEach(event => {
      const tab = event[payloadObj][payloadKey];
      const currentTime = new Date(event.time_stamp);
      let duration = 0;
      if (prevTime) duration = (currentTime - prevTime) / 1000;
      prevTime = currentTime;
      sessionResults.push({ user_name: user, session_id: event.session_id, tab, durationSeconds: duration });
      totals[user][tab] = (totals[user][tab] || 0) + duration;
    });

    Object.entries(totals[user]).forEach(([tab, total]) => {
      averages[user][tab] = total / sessionEvents.length;
    });
  }

  return { sessions: sessionResults, totals, averages };
};

// ----------------- EXPRESS APP -----------------
const app = express();
app.use(bodyParser.json());

app.post("/api/events", async (req, res) => {
  try {
    const { inputEventType } = req.body;
    const data = await fetchDataPoolByQueries({ inputEventType });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const { user_name } = req.body;
    const data = await sessionFetchByQueries({ user_name });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------- END-TO-END HTML TEST -----------------
describe("Full HTML → backend → utils end-to-end", () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    dom = new JSDOM(`
      <html>
        <body>
          <form id="eventForm">
            <input name="inputEventType" value="Create" />
            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `, { runScripts: "dangerously", resources: "usable" });

    window = dom.window;
    document = window.document;

    // patch fetch for form
    window.fetch = (url, options) => {
      const body = JSON.parse(options.body);
      return request(app)
        .post(url)
        .send(body)
        .then(res => ({ json: async () => res.body }));
    };

    // form submission handler
    const form = document.getElementById("eventForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = e.target.querySelector('[name="inputEventType"]');
      const response = await window.fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputEventType: input.value })
      });
      window.responseData = await response.json();
    });
  });

  it("submits HTML form and receives Create events", async () => {
    const form = document.getElementById("eventForm");
    form.dispatchEvent(new window.Event("submit", { bubbles: true }));

    // wait until window.responseData is set
    await new Promise(resolve => {
      const check = () => {
        if (window.responseData) return resolve();
        setTimeout(check, 5);
      };
      check();
    });

    expect(window.responseData).toBeDefined();
    expect(window.responseData.meta.inputEventType).toBe("Create");
    expect(window.responseData.events[0].payload.classname).toBe("cad_aperture");
  });

  it("fetches sessions directly via POST /api/sessions", async () => {
    const res = await request(app).post("/api/sessions").send({});
    expect(res.body.sessions.length).toBe(3);
    expect(res.body.totals["Bianca Webster"]["TabA"]).toBe(300);
  });
});