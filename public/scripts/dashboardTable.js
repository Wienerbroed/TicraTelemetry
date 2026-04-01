import { Widget } from './widgets.js';
import { fetchJson } from './utils.js';
import { drawTable } from './tableRenderer.js';

/* =========================
   TABLE WIDGET
========================= */
export class TableWidget extends Widget {

  constructor(wrapper) {
    super(wrapper);

    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 10);

    const format = d => d.toISOString().split('T')[0];

    this.wrapper = wrapper;
    this._customTitle = false;

    this.wrapper.innerHTML = `
      <div class="widget" draggable="true">

        <div class="widget-header">
          <div class="widget-title" contenteditable="true">Untitled Widget</div>
          <div class="widget-meta"></div>

          <label>Start:
            <input type="date" class="startDate" value="${format(past)}">
          </label>

          <label>End:
            <input type="date" class="endDate" value="${format(today)}">
          </label>

          <div class="filter-row">
            <div class="dropdown">
              <button class="dropdown-btn">Event Types ▼</button>
              <div class="dropdown-content eventTypeGroup"></div>
            </div>

            <div class="dropdown">
              <button class="dropdown-btn">Employee Types ▼</button>
              <div class="dropdown-content employeeTypeGroup"></div>
            </div>
          </div>

          <button class="applyBtn">Apply</button>
        </div>

        <div class="widget-content">
          <div class="tableContainer" style="overflow:auto; max-height:auto;">
            <table>
              <thead></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <!-- RESIZE CONTROLS -->
        <div class="resize-controls-right">
          <button class="resize-plus-x">+</button>
          <button class="resize-minus-x">−</button>
        </div>

        <div class="resize-controls-bottom">
          <button class="resize-plus-y">+</button>
          <button class="resize-minus-y">−</button>
        </div>

      </div>
    `;

    this.bind();
    this.loadFilters();
    this.initDropdowns();
    this.initResizeControls(); // IMPORTANT
  }

  bind() {
    this.container.querySelector('.applyBtn')
      .addEventListener('click', () => this.apply());
  }

  async apply() {

    const selectedEvents = this.getChecked(this.container.querySelector('.eventTypeGroup'));
    const selectedEmployees = this.getChecked(this.container.querySelector('.employeeTypeGroup'));

    if (selectedEvents.length === 0) return;

    const startDate = this.container.querySelector('.startDate').value;
    const endDate = this.container.querySelector('.endDate').value;

    this.events = [];

    for (const eventType of selectedEvents) {

      const params = new URLSearchParams();
      params.append('inputEventType', eventType);

      if (startDate) params.append('startTime', startDate + 'T00:00:00');
      if (endDate) params.append('endTime', endDate + 'T23:59:59');

      selectedEmployees.forEach(emp => params.append('employeeType', emp));

      const data = await fetchJson(`/data?${params.toString()}`);

      this.events.push(...(data.events ?? []).map(ev => ({
        eventType,
        user: ev.user_name ?? "unknown",
        selection: Object.values(ev.payload ?? {})[0] ?? "unknown",
        count: ev.count ?? 0
      })));
    }

    this.renderTable();
    this.setMeta(this.buildMeta());

    if (!this.isCustomTitle()) {
      this.setTitle('Table Widget');
    }
  }

  renderTable() {
    const perUser = this.buildPerUser(this.events);

    drawTable(perUser, {
      userOrder: Object.keys(perUser),
      eventTypeOrder: this.extractEventTypes(this.events),
      rowSortStates: {},
      tableElement: this.container.querySelector('table')
    });

    setStickyColumns(this.container.querySelector('table'));
  }

  initDropdowns() {
    this.wrapper.querySelectorAll('.dropdown').forEach(drop => {

      const btn = drop.querySelector('.dropdown-btn');

      btn.addEventListener('click', e => {
        e.stopPropagation();

        document.querySelectorAll('.dropdown').forEach(d => {
          if (d !== drop) d.classList.remove('open');
        });

        drop.classList.toggle('open');
      });

      drop.addEventListener('click', e => e.stopPropagation());
    });
  }
}

/* =========================
   SESSION TABLE UTILS
========================= */
export async function buildSessionTable(container, { start, end, eventType, employee }) {
  const params = new URLSearchParams();
  params.append("configTitle", eventType);
  params.append("startTime", start);
  params.append("endTime", end);

  if (employee) {
    if (employee.type === "type") {
      params.append("employee_type", employee.value);
    } else if (employee.type === "user") {
      params.append("user_name", employee.value);
    }
  }

  const data = await fetchJson(`/session?${params}`);
  const sessions = data.sessions || [];

  const table = container.querySelector('table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (!sessions.length) {
    tbody.innerHTML = '<tr><td colspan="100%">No sessions found for this selection</td></tr>';
    return;
  }

  const perUser = {};
  sessions.forEach(s => {
    const u = s.user_name || "Unknown";
    if (!perUser[u]) perUser[u] = [];
    perUser[u].push(s);
  });

  let columns;
  if (employee && employee.type === "user") {
    columns = [...new Set(sessions.map(s => s.session_id))].sort();
  } else {
    columns = Object.keys(perUser).sort();
  }

  const tabs = [...new Set(sessions.map(s => s.tab))].sort();

  // HEADER
  const hr = document.createElement('tr');
  const colHeaders = ['Operation', 'AVG', 'TOTAL', ...columns];
  colHeaders.forEach((t, i) => {
    const th = document.createElement('th');
    th.classList.add('rotate');
    if (i === 1) th.classList.add('avg');
    if (i === 2) th.classList.add('total');
    const div = document.createElement('div');
    div.textContent = t;
    th.appendChild(div);
    hr.appendChild(th);
  });
  thead.appendChild(hr);

  // ------------------------
  // COLUMN-BASED HEATMAP
  // ------------------------
  const columnMaxes = columns.map((col, colIndex) => {
    return Math.max(...tabs.map(tab => {
      if (employee && employee.type === "user") {
        return sessions
          .filter(s => s.tab === tab && s.session_id === col)
          .reduce((a, b) => a + b.durationSeconds, 0);
      } else {
        return (perUser[col] || [])
          .filter(s => s.tab === tab)
          .reduce((a, b) => a + b.durationSeconds, 0);
      }
    }));
  });

  // ROWS
  tabs.forEach(tab => {
    const tr = document.createElement('tr');

    const opTd = document.createElement('td');
    opTd.textContent = tab;
    tr.appendChild(opTd);

    const vals = columns.map(col => {
      if (employee && employee.type === "user") {
        return sessions
          .filter(s => s.tab === tab && s.session_id === col)
          .reduce((a, b) => a + b.durationSeconds, 0);
      } else {
        return (perUser[col] || [])
          .filter(s => s.tab === tab)
          .reduce((a, b) => a + b.durationSeconds, 0);
      }
    });

    const total = vals.reduce((a, b) => a + b, 0);
    const avg = vals.length ? total / vals.length : 0;

    const avgTd = createCell(formatTime(avg));
    avgTd.classList.add('avg');
    tr.appendChild(avgTd);

    const totalTd = createCell(formatTime(total));
    totalTd.classList.add('total');
    tr.appendChild(totalTd);

    // DATA CELLS WITH COLUMN HEATMAP
    vals.forEach((v, colIndex) => {
      const td = createCell(formatTime(v));
      td.style.background = heatColor(v, columnMaxes[colIndex]);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  setStickyColumns(table);
}

// Helper functions
function createCell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  td.style.textAlign = 'center';
  return td;
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function heatColor(val, max) {
  if (!max) return '#fff';
  const i = Math.sqrt(val / max);
  return `hsl(120,70%,${100 - i * 60}%)`;
}

export function setStickyColumns(table) {
  const stickyIndexes = [0, 1, 2];
  const colWidths = [];
  const headerRow = table.querySelector('thead tr');

  stickyIndexes.forEach((i, index) => {
    const th = headerRow.children[i];
    const w = th.offsetWidth;
    colWidths.push(w);
    th.classList.add('sticky');
    th.style.zIndex = 4;
    th.style.left = stickyIndexes.slice(0, index).reduce((sum, j) => sum + colWidths[j], 0) + 'px';
  });

  table.querySelectorAll('tbody tr').forEach(row => {
    stickyIndexes.forEach((i, index) => {
      const td = row.children[i];
      td.classList.add('sticky');
      td.style.zIndex = 2;
      td.style.left = stickyIndexes.slice(0, index).reduce((sum, j) => sum + colWidths[j], 0) + 'px';
    });
  });
}

/* =========================
   SESSION TABLE WIDGET
========================= */
export class SessionTableWidget extends Widget {
  constructor(wrapper) {
    super(wrapper);
    this.wrapper = wrapper;

    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 10);
    const format = d => d.toISOString().split('T')[0];

    // Widget HTML
    this.wrapper.innerHTML = `
      <div class="widget" draggable="true">
        <div class="widget-header">
          <div class="widget-title" contenteditable="true">Session Table</div>
          <div class="widget-summary"></div>

          <label>Start:
            <input type="date" class="startDate" value="${format(past)}">
          </label>

          <label>End:
            <input type="date" class="endDate" value="${format(now)}">
          </label>

          <div class="filter-row">
            <div class="dropdown">
              <button class="dropdown-btn">Event Types ▼</button>
              <div class="dropdown-content eventTypeGroup"></div>
            </div>

            <div class="dropdown">
              <button class="dropdown-btn">Employee Types ▼</button>
              <div class="dropdown-content employeeTypeGroup"></div>
            </div>
          </div>

          <button class="applyBtn">Apply</button>
        </div>

        <div class="widget-content">
          <div class="tableContainer" style="overflow:auto; max-height:auto;">
            <table>
              <thead></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <!-- RESIZE CONTROLS -->
        <div class="resize-controls-right">
          <button class="resize-plus-x">+</button>
          <button class="resize-minus-x">−</button>
        </div>

        <div class="resize-controls-bottom">
          <button class="resize-plus-y">+</button>
          <button class="resize-minus-y">−</button>
        </div>
      </div>
    `;

    this.cache();
    this.loadFilters();
    this.initDropdowns();
    this.initResizeControls();
    this.bind();
  }

  cache() {
    this.container = this.wrapper; // container for resize controls
    this.innerWidget = this.wrapper.querySelector('.widget'); // actual widget

    this.start = this.innerWidget.querySelector('.startDate');
    this.end = this.innerWidget.querySelector('.endDate');
    this.eventTypeGroup = this.innerWidget.querySelector('.eventTypeGroup');
    this.employeeTypeGroup = this.innerWidget.querySelector('.employeeTypeGroup');
    this.applyBtn = this.innerWidget.querySelector('.applyBtn');
    this.tableContainer = this.innerWidget.querySelector('.tableContainer');
    this.table = this.tableContainer.querySelector('table');
    this.title = this.innerWidget.querySelector('.widget-title');
    this.summary = this.innerWidget.querySelector('.widget-summary');
  }

  async loadFilters() {
    const eventTypes = await fetchJson('/sessionTypes');
    const employeeTypes = await fetchJson('/employeeTypes');
    const users = await fetchJson('/users');

    // Helper: create single-select checkbox in a container
    const createSingleSelectCheckbox = (container, value, type = null) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${value}"> ${value}`;
      if (type) label.querySelector('input').dataset.type = type;

      const checkbox = label.querySelector('input');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb !== checkbox) cb.checked = false;
          });
        }
      });

      container.appendChild(label);
    };

    // Event Types (single-select)
    eventTypes.forEach(e => createSingleSelectCheckbox(this.eventTypeGroup, e));

    // Employee Types (single-select)
    if (employeeTypes.length) {
      const groupLabel = document.createElement('div'); 
      groupLabel.textContent = "Employee Types:";
      this.employeeTypeGroup.appendChild(groupLabel);

      employeeTypes.forEach(t => createSingleSelectCheckbox(this.employeeTypeGroup, t, "type"));
    }

    // Users (single-select)
    if (users.length) {
      const groupLabel = document.createElement('div'); 
      groupLabel.textContent = "Employees:";
      this.employeeTypeGroup.appendChild(groupLabel);

      users.forEach(u => createSingleSelectCheckbox(this.employeeTypeGroup, u, "user"));
    }
  }

  initDropdowns() {
    this.innerWidget.querySelectorAll('.dropdown').forEach(drop => {
      const btn = drop.querySelector('.dropdown-btn');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown').forEach(d => {
          if (d !== drop) d.classList.remove('open');
        });
        drop.classList.toggle('open');
      });
      drop.addEventListener('click', e => e.stopPropagation());
    });

    document.addEventListener('click', () => {
      this.innerWidget.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    });
  }

  getChecked(container) {
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(c => ({
      value: c.value,
      type: c.dataset.type || null
    }));
  }

  bind() {
    this.applyBtn.addEventListener('click', async () => {
      const selectedEvents = this.getChecked(this.eventTypeGroup);
      const selectedEmployees = this.getChecked(this.employeeTypeGroup);

      if (!selectedEvents.length) return;

      const startDate = this.start.value;
      const endDate = this.end.value;

      this.summary.textContent = `${selectedEvents.map(e => e.value).join(', ')} - ${selectedEmployees.map(e => e.value).join(', ') || 'All'} - ${startDate} -> ${endDate}`;

      // Build session table for first selected employee (single-select)
      await buildSessionTable(this.wrapper, {
        start: startDate,
        end: endDate,
        eventType: selectedEvents[0].value,
        employee: selectedEmployees.length ? selectedEmployees[0] : null
      });

      setStickyColumns(this.table);

      // Add clickable links for session IDs
      this.addSessionLinks();
    });
  }

  addSessionLinks() {
    const tbody = this.table.querySelector('tbody');
    if (!tbody) return;

    [...tbody.querySelectorAll('tr')].forEach(row => {
      const sessionCell = row.querySelector('td.sessionId');
      if (sessionCell && !sessionCell.querySelector('a')) {
        const sessionId = sessionCell.textContent.trim();
        const link = document.createElement('a');
        link.href = "#";
        link.textContent = sessionId;
        link.addEventListener('click', e => {
          e.preventDefault();
          this.createTimelineWidget(sessionId);
        });
        sessionCell.textContent = "";
        sessionCell.appendChild(link);
      }
    });
  }

  createTimelineWidget(sessionId) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('widget-large');
    this.wrapper.parentElement.appendChild(wrapper);

    // Create a simple inline timeline widget inside this wrapper
    wrapper.innerHTML = `
      <div class="widget" draggable="true">
        <div class="widget-header">
          <div class="widget-title">Timeline: ${sessionId}</div>
        </div>
        <div class="widget-content">
          <div class="timelineContainer">
            <!-- Timeline content based on session ID will go here -->
            <p>Loading timeline for session ${sessionId}...</p>
          </div>
        </div>
      </div>
    `;
  }
}