import { fetchJson } from './utils.js';

export class Widget {

  constructor(container) {
    this.container = container;
  }

  /* =========================
     RESIZE SYSTEM (ADDED)
  ========================= */

  initResizeControls() {

    const widget = this.container.classList.contains('widget') ? this.container : this.container.querySelector('.widget');
    if (!widget) return;

    let colSpan =
      this.container.classList.contains('widget-full') ? 4 :
      this.container.classList.contains('widget-large') ? 2 : 1;

    let heightMultiplier = 1;

    const MIN_COL = 1;
    const MAX_COL = 4;

    const MIN_ROW = 1;
    const MAX_ROW = 5;

    const applyCol = () => {
      this.container.classList.remove('widget-small','widget-large','widget-full');

      if (colSpan === 1) this.container.classList.add('widget-small');
      if (colSpan === 2) this.container.classList.add('widget-large');
      if (colSpan === 3) this.container.classList.add('widget-large');
      if (colSpan === 4) this.container.classList.add('widget-full');
    };

    const applyHeight = () => {
      widget.style.height = (450 * heightMultiplier) + 'px';
    };

    const plusX = this.container.querySelector('.resize-plus-x');
    const minusX = this.container.querySelector('.resize-minus-x');
    const plusY = this.container.querySelector('.resize-plus-y');
    const minusY = this.container.querySelector('.resize-minus-y');

    if (plusX) {
      plusX.addEventListener('click', e => {
        e.stopPropagation();
        if (colSpan < MAX_COL) {
          colSpan++;
          applyCol();
        }
      });
    }

    if (minusX) {
      minusX.addEventListener('click', e => {
        e.stopPropagation();
        if (colSpan > MIN_COL) {
          colSpan--;
          applyCol();
        }
      });
    }

    if (plusY) {
      plusY.addEventListener('click', e => {
        e.stopPropagation();
        if (heightMultiplier < MAX_ROW) {
          heightMultiplier++;
          applyHeight();
        }
      });
    }

    if (minusY) {
      minusY.addEventListener('click', e => {
        e.stopPropagation();
        if (heightMultiplier > MIN_ROW) {
          heightMultiplier--;
          applyHeight();
        }
      });
    }

    applyCol();
    applyHeight();
  }

  /* =========================
     YOUR EXISTING CODE (UNCHANGED)
  ========================= */

  async loadFilters() {

    const events = await fetchJson('/eventQueries');
    const employees = await fetchJson('/employeeTypes');

    const eventContainer = this.container.querySelector('.eventTypeGroup');
    const empContainer = this.container.querySelector('.employeeTypeGroup');

    events.forEach(ev => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = ev;

      label.appendChild(input);
      label.appendChild(document.createTextNode(ev));
      eventContainer.appendChild(label);
    });

    if (empContainer) {
      employees.forEach(emp => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = emp;

        label.appendChild(input);
        label.appendChild(document.createTextNode(emp));
        empContainer.appendChild(label);
      });
    }
  }

  getChecked(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input:checked'))
      .map(i => i.value);
  }

  buildPerUser(events) {
    const perUser = {};

    events.forEach(e => {
      if (!perUser[e.user]) perUser[e.user] = {};
      const key = `${e.eventType}::${e.selection}`;
      perUser[e.user][key] =
        (perUser[e.user][key] ?? 0) + e.count;
    });

    return perUser;
  }

  extractEventTypes(events) {
    return [...new Set(events.map(e => e.eventType))];
  }

  isCustomTitle() {
    return this._customTitle === true;
  }

  setTitle(text) {
    const titleEl = this.container.querySelector('.widget-title');
    if (!this.isCustomTitle()) {
      titleEl.textContent = text;
    }
  }

  setMeta(text) {
    const metaEl = this.container.querySelector('.widget-meta');
    if (metaEl) metaEl.textContent = text;
  }

  buildMeta() {

    const selectedEvents = this.getChecked(this.container.querySelector('.eventTypeGroup'));
    const selectedEmployees = this.getChecked(this.container.querySelector('.employeeTypeGroup'));

    const start = this.container.querySelector('.startDate')?.value || 'N/A';
    const end = this.container.querySelector('.endDate')?.value || 'N/A';

    const eventPart = selectedEvents.length ? selectedEvents.join(', ') : 'All Events';
    const empPart = selectedEmployees.length ? selectedEmployees.join(', ') : 'All Employees';

    return `Events: ${eventPart} | Employees: ${empPart} | ${start} → ${end}`;
  }
}