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