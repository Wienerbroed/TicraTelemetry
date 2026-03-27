import { Widget } from './widgets.js';
import { fetchJson } from './utils.js';
import { drawTable } from './tableRenderer.js';

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
          <div class="tableContainer">
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

function setStickyColumns(table) {
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

    this.wrapper.innerHTML = `
      <div class="widget" draggable="true">
        <div class="widget-header" contenteditable="true">Session Table</div>
        <div class="widget-summary"></div>
        <div class="widget-body">
          <div class="filters">
            <input type="datetime-local" class="startTime">
            <input type="datetime-local" class="endTime">
            <select class="eventType"><option value="">Event Type</option></select>
            <select class="employee"><option value="">All</option></select>
            <button class="applyBtn">Apply</button>
          </div>
          <div style="overflow:auto; max-height:400px;">
            <table><thead></thead><tbody></tbody></table>
          </div>
        </div>
      </div>
    `;

    this.cache();
    this.setDefaults();
    this.loadDropdowns();
    this.bind();
  }

  cache() {
    this.start = this.wrapper.querySelector('.startTime');
    this.end = this.wrapper.querySelector('.endTime');
    this.eventType = this.wrapper.querySelector('.eventType');
    this.employee = this.wrapper.querySelector('.employee');
    this.applyBtn = this.wrapper.querySelector('.applyBtn');
    this.table = this.wrapper.querySelector('table');
    this.header = this.wrapper.querySelector('.widget-header');
    this.summary = this.wrapper.querySelector('.widget-summary');
  }

  setDefaults() {
    const now = new Date();
    const past = new Date(); past.setDate(now.getDate() - 10);
    const f = d => d.toISOString().slice(0,16);
    this.start.value = f(past);
    this.end.value = f(now);
  }

  async loadDropdowns() {
    const eventTypes = await fetchJson('/sessionTypes');
    eventTypes.forEach(e => {
      const o = document.createElement('option'); o.value = e; o.textContent = e;
      this.eventType.appendChild(o);
    });

    const employeeTypes = await fetchJson('/employeeTypes');
    const users = await fetchJson('/users');

    if (employeeTypes.length) {
      const g = document.createElement('optgroup'); g.label = "Employee Types";
      employeeTypes.forEach(t => {
        const o = document.createElement('option'); o.value = t; o.textContent = t; o.dataset.type = "type";
        g.appendChild(o);
      });
      this.employee.appendChild(g);
    }

    if (users.length) {
      const g = document.createElement('optgroup'); g.label = "Employees";
      users.forEach(u => {
        const o = document.createElement('option'); o.value = u; o.textContent = u; o.dataset.type = "user";
        g.appendChild(o);
      });
      this.employee.appendChild(g);
    }
  }

  bind() {
    this.applyBtn.onclick = async () => {
      const empOpt = this.employee.value ? this.employee.selectedOptions[0] : null;
      const employeeData = empOpt ? { value: empOpt.value, type: empOpt.dataset.type } : null;

      const startTime = this.start.value.replace("T"," ");
      const endTime = this.end.value.replace("T"," ");
      const empText = employeeData?.value || "All";
      this.summary.textContent = `${this.eventType.value} - ${empText} - ${startTime} -> ${endTime}`;

      await buildSessionTable(this.wrapper, {
        start: this.start.value,
        end: this.end.value,
        eventType: this.eventType.value,
        employee: employeeData
      });
    };
  }
}