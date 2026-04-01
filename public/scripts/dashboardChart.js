import { Widget } from './widgets.js';
import { fetchJson } from './utils.js';
import { getColorForType } from './colors.js';

export class ChartWidget extends Widget {

  constructor(wrapper) {
    super(wrapper);

    this.isPercent = false;

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
          <div class="chartControls"></div>
          <div class="chartContainer"></div>
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
    this.loadFilters(); // overridden below
    this.initDropdowns();
    this.initResizeControls();

    const titleEl = this.wrapper.querySelector('.widget-title');
    titleEl.addEventListener('input', () => {
      this._customTitle = true;
    });
  }

  /* =========================
     ONLY CHANGE (SAFE OVERRIDE)
  ========================= */

  async loadFilters() {
    // call parent loader
    await super.loadFilters();

    const container = this.container.querySelector('.eventTypeGroup');
    if (!container) return;

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          checkboxes.forEach(other => {
            if (other !== cb) other.checked = false;
          });
        }
      });
    });
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

    this.renderChart();
    this.setMeta(this.buildMeta());

    if (!this.isCustomTitle()) {
      this.setTitle('Chart Widget');
    }
  }

  renderChart() {

    const perUser = this.buildPerUser(this.events);
    const container = this.container.querySelector('.chartContainer');
    const controls = this.container.querySelector('.chartControls');

    container.innerHTML = '';
    controls.innerHTML = '';

    const eventType = this.extractEventTypes(this.events)[0];
    if (!eventType) return;

    const selections = new Set();

    Object.values(perUser).forEach(u => {
      Object.keys(u)
        .filter(k => k.startsWith(eventType + '::'))
        .forEach(k => selections.add(k));
    });

    const labels = Array.from(selections).map(s => s.split('::')[1]);

    let values = Array.from(selections).map(sel =>
      Object.values(perUser).reduce((sum, u) => sum + (u[sel] ?? 0), 0)
    );

    /* =========================
       SLIDER
    ========================= */

    const track = document.createElement('div');
    track.className = 'sliderTrack';

    const knob = document.createElement('div');
    knob.className = 'sliderKnob';

    knob.style.left = this.isPercent ? '40px' : '0px';

    track.appendChild(knob);

    controls.appendChild(document.createTextNode('Numbers'));
    controls.appendChild(track);
    controls.appendChild(document.createTextNode('%'));

    track.addEventListener('click', () => {
      this.isPercent = !this.isPercent;
      this.renderChart();
    });

    /* =========================
       VALUES
    ========================= */

    let displayValues = values;

    if (this.isPercent) {
      const total = values.reduce((a, b) => a + b, 0) || 1;
      displayValues = values.map(v => (v / total) * 100);
    }

    /* =========================
       COLORS
    ========================= */

    const colors = labels.map(l => getColorForType(l));

    /* =========================
       CHART
    ========================= */

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: displayValues,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: this.isPercent ? 100 : undefined,
            ticks: {
              callback: v => this.isPercent ? v + '%' : v
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => this.isPercent
                ? ctx.raw.toFixed(2) + '%'
                : ctx.raw
            }
          }
        }
      }
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

export class SessionChartWidget extends Widget {
  constructor(wrapper) {
    super(wrapper);

    this.wrapper = wrapper;
    this.currentFormat = 'seconds';
    this.chartData = { labels: [], values: [] };
    this._customTitle = false;

    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 10);
    const f = d => d.toISOString().slice(0, 16);

    this.wrapper.innerHTML = `
      <div class="widget" draggable="true">

        <div class="widget-header">
          <div class="widget-title" contenteditable="true">Session Chart</div>
          <div class="widget-meta"></div>

          <label>Start:
            <input type="datetime-local" class="startTime" value="${f(past)}">
          </label>

          <label>End:
            <input type="datetime-local" class="endTime" value="${f(now)}">
          </label>

          <div class="filter-row">
            <div class="dropdown">
              <button class="dropdown-btn">Event Types ▼</button>
              <div class="dropdown-content eventTypeGroup"></div>
            </div>

            <div class="dropdown">
              <button class="dropdown-btn">Employees ▼</button>
              <div class="dropdown-content employeeGroup"></div>
            </div>
          </div>

          <button class="applyBtn">Apply</button>
        </div>

        <div class="widget-content">
          <div class="chartControls"></div>
          <div class="chartContainer">
            <canvas class="chartCanvas"></canvas>
          </div>
        </div>

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
    this.loadDropdowns();
    this.bind();
    this.initDropdowns();
    this.initResizeControls();

    const titleEl = this.wrapper.querySelector('.widget-title');
    titleEl.addEventListener('input', () => {
      this._customTitle = true;
    });
  }

  cache() {
    this.start = this.wrapper.querySelector('.startTime');
    this.end = this.wrapper.querySelector('.endTime');
    this.applyBtn = this.wrapper.querySelector('.applyBtn');

    this.eventTypeGroup = this.wrapper.querySelector('.eventTypeGroup');
    this.employeeGroup = this.wrapper.querySelector('.employeeGroup');

    this.chartCanvas = this.wrapper.querySelector('.chartCanvas');
    this.chartContainer = this.wrapper.querySelector('.chartContainer');
    this.controls = this.wrapper.querySelector('.chartControls');
  }

  async loadDropdowns() {
    const eventTypes = await fetchJson('/sessionTypes');
    const employeeTypes = await fetchJson('/employeeTypes');
    const users = await fetchJson('/users');

    // Event types
    eventTypes.forEach(type => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${type}"> ${type}`;
      this.eventTypeGroup.appendChild(label);
    });

    // Employee TYPES
    if (employeeTypes.length) {
      const groupLabel = document.createElement('div');
      groupLabel.textContent = "Employee Types";
      groupLabel.classList.add('dropdown-group-label');
      this.employeeGroup.appendChild(groupLabel);

      employeeTypes.forEach(type => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${type}" data-type="type"> ${type}`;
        this.employeeGroup.appendChild(label);
      });
    }

    // USERS
    if (users.length) {
      const groupLabel = document.createElement('div');
      groupLabel.textContent = "Employees";
      groupLabel.classList.add('dropdown-group-label');
      this.employeeGroup.appendChild(groupLabel);

      users.forEach(user => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${user}" data-type="user"> ${user}`;
        this.employeeGroup.appendChild(label);
      });
    }

    // OPTIONAL: only allow one employee selection (like old select)
    const checkboxes = this.employeeGroup.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          checkboxes.forEach(other => {
            if (other !== cb) other.checked = false;
          });
        }
      });
    });
  }

  getChecked(container) {
    return Array.from(container.querySelectorAll('input:checked'))
      .map(cb => cb.value);
  }

  bind() {
    this.applyBtn.addEventListener('click', () => this.apply());

    // format buttons
    ['%', 'sec', 'HH'].forEach(fmt => {
      const btn = document.createElement('button');
      btn.textContent = fmt;

      if (fmt === 'sec') btn.classList.add('active');

      btn.onclick = () => {
        this.currentFormat =
          fmt === '%' ? 'percent' :
          fmt === 'sec' ? 'seconds' : 'hhmmss';

        this.controls.querySelectorAll('button')
          .forEach(b => b.classList.remove('active'));

        btn.classList.add('active');
        this.updateChartLabels();
      };

      this.controls.appendChild(btn);
    });
  }

  async apply() {
    const selectedEvents = this.getChecked(this.eventTypeGroup);

    if (!selectedEvents.length) return;

    const params = new URLSearchParams();
    params.append("configTitle", selectedEvents[0]);
    params.append("startTime", this.start.value);
    params.append("endTime", this.end.value);

    // handle employee type vs user
    const selectedEmployeeInputs = Array.from(
      this.employeeGroup.querySelectorAll('input:checked')
    );

    selectedEmployeeInputs.forEach(input => {
      if (input.dataset.type === 'type') {
        params.append("employee_type", input.value);
      } else {
        params.append("user_name", input.value);
      }
    });

    const data = await fetchJson(`/session?${params}`);
    const sessions = data.sessions || [];

    if (!sessions.length) {
      this.chartContainer.innerHTML = 'No data';
      return;
    }

    const perTab = {};
    sessions.forEach(s => {
      const tab = s.tab || "Unknown";
      if (!perTab[tab]) perTab[tab] = 0;
      perTab[tab] += s.durationSeconds;
    });

    this.chartData.labels = Object.keys(perTab);
    this.chartData.values = Object.values(perTab);

    this.renderChart();

    this.setMeta(
      `${selectedEvents[0]} | ${this.start.value} → ${this.end.value}`
    );

    if (!this._customTitle) {
      this.setTitle('Session Chart');
    }
  }

  formatValue(v) {
    const total = this.chartData.values.reduce((a, b) => a + b, 0);

    if (this.currentFormat === 'percent') {
      return total ? ((v / total) * 100).toFixed(1) + '%' : '0%';
    }

    if (this.currentFormat === 'seconds') {
      return Math.round(v) + 's';
    }

    if (this.currentFormat === 'hhmmss') {
      const h = Math.floor(v / 3600);
      const m = Math.floor((v % 3600) / 60);
      const s = Math.floor(v % 60);

      return `${String(h).padStart(2,'0')}:` +
             `${String(m).padStart(2,'0')}:` +
             `${String(s).padStart(2,'0')}`;
    }

    return v;
  }

  renderChart() {
    if (this.chart) this.chart.destroy();

    this.chart = new Chart(this.chartCanvas, {
      type: 'bar',
      data: {
        labels: this.chartData.labels,
        datasets: [{
          data: this.chartData.values,
          backgroundColor: this.chartData.labels.map((_, i) =>
            `hsl(${(i * 60) % 360}, 70%, 60%)`
          )
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => this.formatValue(ctx.raw)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: v => this.formatValue(v)
            }
          }
        }
      }
    });
  }

  updateChartLabels() {
    if (!this.chart) return;

    this.chart.options.scales.y.ticks.callback =
      v => this.formatValue(v);

    this.chart.options.plugins.tooltip.callbacks.label =
      ctx => this.formatValue(ctx.raw);

    this.chart.update();
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