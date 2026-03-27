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

    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 10);
    const f = d => d.toISOString().slice(0,16);

    this.wrapper.innerHTML = `
      <div class="widget" draggable="true">
        <div class="widget-header" contenteditable="true">Session Chart</div>
        <div class="widget-summary"></div>
        <div class="widget-body">
          <div class="filters">
            <input type="datetime-local" class="startTime" value="${f(past)}">
            <input type="datetime-local" class="endTime" value="${f(now)}">
            <select class="eventType"><option value="">Event Type</option></select>
            <select class="employee"><option value="">All</option></select>
            <button class="applyBtn">Apply</button>
          </div>
          <div class="chartWrapper">
            <div class="format-slider"></div>
            <canvas class="chartCanvas"></canvas>
          </div>
        </div>
      </div>
    `;

    this.cache();
    this.loadDropdowns();
    this.bind();
  }

  cache() {
    this.start = this.wrapper.querySelector('.startTime');
    this.end = this.wrapper.querySelector('.endTime');
    this.eventType = this.wrapper.querySelector('.eventType');
    this.employee = this.wrapper.querySelector('.employee');
    this.applyBtn = this.wrapper.querySelector('.applyBtn');
    this.chartWrapper = this.wrapper.querySelector('.chartWrapper');
    this.summary = this.wrapper.querySelector('.widget-summary');
    this.slider = this.wrapper.querySelector('.format-slider');
    this.chartCanvas = this.wrapper.querySelector('.chartCanvas');
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
      employeeTypes.forEach(t=>{
        const o = document.createElement('option'); o.value=t; o.textContent=t; o.dataset.type="type";
        g.appendChild(o);
      });
      this.employee.appendChild(g);
    }

    if (users.length) {
      const g = document.createElement('optgroup'); g.label="Employees";
      users.forEach(u=>{
        const o = document.createElement('option'); o.value=u; o.textContent=u; o.dataset.type="user";
        g.appendChild(o);
      });
      this.employee.appendChild(g);
    }
  }

  bind() {
    ['%','sec','HH'].forEach(fmt=>{
      const btn=document.createElement('button'); btn.textContent=fmt;
      if(fmt==='sec') btn.classList.add('active');
      btn.onclick=()=> {
        this.currentFormat = fmt==='%'?'percent':fmt==='sec'?'seconds':'hhmmss';
        this.slider.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this.updateChartLabels();
      };
      this.slider.appendChild(btn);
    });

    this.applyBtn.onclick=async ()=>{
      if(!this.eventType.value) return;

      const empOpt = this.employee.value ? this.employee.selectedOptions[0] : null;
      const employeeData = empOpt ? {value: empOpt.value,type: empOpt.dataset.type} : null;

      const params = new URLSearchParams();
      params.append("configTitle", this.eventType.value);
      params.append("startTime", this.start.value);
      params.append("endTime", this.end.value);
      if(employeeData?.type==="type") params.append("employee_type", employeeData.value);
      else if(employeeData?.type==="user") params.append("user_name", employeeData.value);

      const data = await fetchJson(`/session?${params}`);
      const sessions = data.sessions || [];
      if(!sessions.length){ this.chartCanvas.style.display='none'; return; }

      const perTab={};
      sessions.forEach(s=>{
        const tab=s.tab||"Unknown";
        if(!perTab[tab]) perTab[tab]=0;
        perTab[tab]+=s.durationSeconds;
      });

      this.chartData.labels=Object.keys(perTab);
      this.chartData.values=Object.values(perTab);
      this.chartCanvas.style.display='block';
      this.renderChart();

      const empText = employeeData?.value || "All";
      this.summary.textContent = `${this.eventType.value} - ${empText} - ${this.start.value} → ${this.end.value}`;
    };
  }

  formatValue(v){
    const total = this.chartData.values.reduce((a,b)=>a+b,0);
    if(this.currentFormat==='percent') return total?((v/total)*100).toFixed(1)+'%':'0%';
    if(this.currentFormat==='seconds') return Math.round(v)+'s';
    if(this.currentFormat==='hhmmss'){
      const h=Math.floor(v/3600), m=Math.floor((v%3600)/60), s=Math.floor(v%60);
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    return v;
  }

  renderChart(){
    if(this.chart) this.chart.destroy();
    this.chart = new Chart(this.chartCanvas,{
      type:'bar',
      data:{ labels:this.chartData.labels,datasets:[{data:this.chartData.values, backgroundColor:this.chartData.labels.map((_,i)=>`hsl(${(i*60)%360},70%,60%)`)}] },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:ctx=>this.formatValue(ctx.raw)}}
        },
        scales:{
          y:{beginAtZero:true,ticks:{callback:v=>this.formatValue(v)}, title:{display:true,text:'Duration'}}
        }
      }
    });
  }

  updateChartLabels(){
    if(!this.chart) return;
    this.chart.options.scales.y.ticks.callback=v=>this.formatValue(v);
    this.chart.options.plugins.tooltip.callbacks.label=ctx=>this.formatValue(ctx.raw);
    this.chart.update();
  }
}