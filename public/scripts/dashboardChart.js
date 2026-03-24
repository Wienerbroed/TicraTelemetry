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