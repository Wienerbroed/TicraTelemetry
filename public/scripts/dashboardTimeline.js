// dashboardTimeline.js
import { Widget } from './widgets.js';

export class TimelineWidget extends Widget {
    constructor(container) {
        super(container);

        // Wrap in a widget container
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('widget', 'widget-large'); // <-- make it 2 columns wide
        this.wrapper.setAttribute('draggable', true);
        container.appendChild(this.wrapper);

        // State
        this.colorMap = {};
        this.zoomFactor = 1;
        this.showFocus = true;
        this.ZOOM_STEP = 0.2;
        this.MIN_ZOOM = 0.5;
        this.MAX_ZOOM = 10;

        this.eventLines = [];
        this.focusLines = [];
        this.tabEventMap = {};

        this.buildUI();
        // Remove resize
        // this.initResizeControls();
        this.bindDraggable();
    }


    buildUI() {
        const wrapper = this.wrapper;
        wrapper.style.padding = '8px';
        wrapper.style.boxSizing = 'border-box';

        this._createHeader(wrapper);
        this._createTimelineContainer(wrapper);
        this._createLegendAndSummary(wrapper);
        this._createTooltip(wrapper);
        this._createControls(wrapper);

        this.searchBtn.onclick = async () => {
            const sessionId = this.searchInput.value.trim();
            if (sessionId) await this.loadTimeline(sessionId);
        };
    }

    bindDraggable() {
        this.wrapper.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', '');
            this.wrapper.classList.add('dragging');
        });
        this.wrapper.addEventListener('dragend', e => {
            this.wrapper.classList.remove('dragging');
        });
    }
}

// ------------------------- UI BUILDERS -------------------------
TimelineWidget.prototype._createHeader = function(wrapper) {
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
    });

    const title = document.createElement('div');
    title.innerText = 'Session Timeline';
    title.classList.add('widget-title');
    Object.assign(title.style, { margin: '0', fontSize: '16px', cursor: 'move' });

    const searchWrapper = document.createElement('div');
    Object.assign(searchWrapper.style, { display: 'flex', gap: '4px' });

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Enter Session ID';
    Object.assign(searchInput.style, { flex: '1', padding: '4px' });
    this.searchInput = searchInput;

    const searchBtn = document.createElement('button');
    searchBtn.innerText = 'Load';
    Object.assign(searchBtn.style, { padding: '4px 8px' });
    this.searchBtn = searchBtn;

    searchWrapper.append(searchInput, searchBtn);
    header.append(title, searchWrapper);
    wrapper.appendChild(header);
};



TimelineWidget.prototype._createTimelineContainer = function(wrapper) {
    const timelineContainer = document.createElement('div');
    Object.assign(timelineContainer.style, {
        width: '600px',
        overflowX: 'auto',
        position: 'relative',
        border: '1px solid #ccc',
        padding: '8px',
        height: '300px',
        boxSizing: 'border-box',
    });

    const timelineDiv = document.createElement('div');
    timelineDiv.id = 'timeline';
    Object.assign(timelineDiv.style, {
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'nowrap',
    });

    timelineContainer.appendChild(timelineDiv);
    wrapper.appendChild(timelineContainer);
    this.timelineDiv = timelineDiv;
};

TimelineWidget.prototype._createLegendAndSummary = function(wrapper) {
    const timelineLegend = document.createElement('div');
    timelineLegend.id = 'timelineLegend';
    Object.assign(timelineLegend.style, {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginTop: '8px',
    });

    const timelineSummary = document.createElement('div');
    timelineSummary.id = 'timelineSummary';
    timelineSummary.style.marginTop = '8px';

    wrapper.append(timelineLegend, timelineSummary);
    this.timelineLegend = timelineLegend;
    this.timelineSummary = timelineSummary;
};

TimelineWidget.prototype._createTooltip = function(wrapper) {
    const tooltip = document.createElement('div');
    tooltip.id = 'tooltip';
    Object.assign(tooltip.style, {
        position: 'absolute',
        backgroundColor: '#333',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        display: 'none',
        pointerEvents: 'none',
        zIndex: '1000',
    });
    wrapper.appendChild(tooltip);
    this.tooltip = tooltip;
};

TimelineWidget.prototype._createControls = function(wrapper) {
    const controls = document.createElement('div');
    Object.assign(controls.style, { display: 'flex', gap: '4px', marginTop: '8px' });

    const buttons = ['Zoom In', 'Zoom Out', 'Reset Zoom', 'Toggle Focus'].map(text => {
        const btn = document.createElement('button');
        btn.innerText = text;
        Object.assign(btn.style, { padding: '4px 8px' });
        controls.appendChild(btn);
        return btn;
    });

    wrapper.appendChild(controls);
    [this.zoomInBtn, this.zoomOutBtn, this.zoomResetBtn, this.toggleFocusBtn] = buttons;
};
// ------------------------- TIMELINE LOGIC -------------------------
TimelineWidget.prototype.loadTimeline = async function(sessionId) {
    const { timelineDiv, timelineLegend, timelineSummary } = this;
    timelineDiv.innerHTML = timelineLegend.innerHTML = timelineSummary.innerHTML = '';
    this.tabEventMap = {};
    this.eventLines = [];
    this.focusLines = [];

    try {
        const response = await fetch(`/sessionTimeline?sessionId=${sessionId}`);
        const data = await response.json();

        if (!data.timeline?.length) {
            timelineSummary.innerHTML = '<p>No events found for this session.</p>';
            return;
        }

        this._renderSummary(data);
        const focusIntervals = this._getFocusIntervals(data.timeline);
        this._renderTimelineEvents(data, focusIntervals);
        this._renderLegend(data);

        // Wire controls
        this.zoomInBtn.onclick = () => this.applyZoom(this.zoomFactor + this.ZOOM_STEP);
        this.zoomOutBtn.onclick = () => this.applyZoom(this.zoomFactor - this.ZOOM_STEP);
        this.zoomResetBtn.onclick = () => this.applyZoom(1);
        this.toggleFocusBtn.onclick = () => { this.showFocus = !this.showFocus; this.applyZoom(this.zoomFactor); };

    } catch (err) {
        console.error("Failed to load timeline:", err);
        timelineSummary.innerHTML = '<p>Unable to load timeline.</p>';
    }
};

TimelineWidget.prototype._renderSummary = function(data) {
    const formatDuration = s => {
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = Math.floor(s % 60);
        return `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    };

    const timestamps = data.timeline.map(ev => new Date(ev.time_stamp)).filter(Boolean);
    const startTime = timestamps.length ? new Date(Math.min(...timestamps)) : null;
    const endTime = timestamps.length ? new Date(Math.max(...timestamps)) : null;

    this.timelineSummary.innerHTML = `
        <div class="summary">
            <strong>Session ID:</strong> ${data.sessionId}<br/>
            <strong>User:</strong> ${data.user_name}<br/>
            <strong>Employee Type:</strong> ${data.employee_type}<br/>
            <strong>Total Events:</strong> ${data.totalEvents}<br/>
            <strong>Duration:</strong> ${startTime?.toLocaleString() ?? 'N/A'} - ${endTime?.toLocaleString() ?? 'N/A'} (Total time spent: ${formatDuration(data.totalDurationSeconds)})
        </div>`;
};

TimelineWidget.prototype._getFocusIntervals = function(timeline) {
    const focusIntervals = [];
    let lostFocusEvent = null;

    timeline.forEach(ev => {
        if (ev.event_type === 'Focus') {
            if (ev.payload === 'Lost Focus') lostFocusEvent = ev;
            else if (ev.payload === 'Got Focus' && lostFocusEvent) {
                focusIntervals.push({
                    startTime: new Date(lostFocusEvent.time_stamp),
                    endTime: new Date(ev.time_stamp),
                });
                lostFocusEvent = null;
            }
        }
    });

    return focusIntervals;
};

TimelineWidget.prototype._renderTimelineEvents = function(data, focusIntervals) {
    const timelineDiv = this.timelineDiv;
    const MIN_TOTAL_WIDTH = 1200;
    const timelineTotalWidth = Math.max(data.timeline.length * 50, MIN_TOTAL_WIDTH);

    // Render Tabpage events first
    data.timeline.forEach(ev => {
        if (ev.event_type !== 'Tabpage') return;
        const box = this._createEventBox(ev, data.totalDurationSeconds, timelineTotalWidth, focusIntervals);
        timelineDiv.appendChild(box);
        this.tabEventMap[ev.event_number] = box;
    });

    // Render other events
    data.timeline.forEach(ev => {
        if (ev.event_type !== 'Tabpage' && ev.event_type !== 'Focus') this._createEventLine(ev, data.timeline);
    });

    // Render focus lines
    focusIntervals.forEach(focus => this._createFocusLines(focus, data.timeline));

    // Initial positioning
    this.updateEventLines();
};

TimelineWidget.prototype._renderLegend = function(data) {
    const legendMap = {};
    data.timeline.forEach(ev => {
        if (!legendMap[ev.event_type]) legendMap[ev.event_type] = new Set();
        legendMap[ev.event_type].add(ev.payload ?? 'No Payload');
    });

    Object.entries(legendMap).forEach(([eventType, payloadSet]) => {
        const section = document.createElement('div');
        section.style.marginBottom = '10px';

        const header = document.createElement('div');
        header.innerText = eventType;
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '4px';
        section.appendChild(header);

        payloadSet.forEach(payload => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.fontSize = '12px';
            item.style.marginBottom = '2px';

            const colorBox = document.createElement('span');
            colorBox.style.width = '12px';
            colorBox.style.height = '12px';
            colorBox.style.display = 'inline-block';
            colorBox.style.marginRight = '6px';
            colorBox.style.borderRadius = '2px';
            colorBox.style.backgroundColor = payload === 'Lost Focus' ? '#888' : this.getColor(eventType, payload);

            const label = document.createElement('span');
            label.innerText = payload;

            item.appendChild(colorBox);
            item.appendChild(label);
            section.appendChild(item);
        });

        this.timelineLegend.appendChild(section);
    });
};

// ------------------------- EVENT BOX & LINE CREATION -------------------------

TimelineWidget.prototype._createEventBox = function(ev, totalDurationSeconds, timelineTotalWidth, focusIntervals) {
    const box = document.createElement('div');
    box.className = 'event-box';
    box.dataset.startTime = new Date(ev.time_stamp).getTime();
    box.dataset.durationSeconds = ev.durationSeconds;

    Object.assign(box.style, {
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        marginRight: '0px',
        flexShrink: 0,
        height: '50px',
    });

    const tabStart = new Date(ev.time_stamp);
    const tabEnd = new Date(tabStart.getTime() + ev.durationSeconds * 1000);

    const segments = this._splitSegmentsByFocus(tabStart, tabEnd, ev.payload, focusIntervals);

    // Compute total width
    let totalWidth = 0;
    segments.forEach(seg => {
        seg.domWidth = Math.max((seg.duration / totalDurationSeconds) * timelineTotalWidth, 2);
        totalWidth += seg.domWidth;
    });
    box.style.width = totalWidth + 'px';
    box.originalWidth = totalWidth;
    box.segments = [];

    // Create DOM for segments
    segments.forEach(seg => {
        const segDiv = document.createElement('div');
        Object.assign(segDiv.style, {
            width: seg.domWidth + 'px',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '12px',
            color: '#fff',
            borderRadius: '4px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
        });
        segDiv.dataset.originalWidth = seg.domWidth;
        segDiv.innerText = seg.isFocus ? 'Lost' : seg.payload;
        segDiv.style.backgroundColor = seg.isFocus ? '#888' : this.getColor('Tabpage', seg.payload);
        if (seg.isFocus) segDiv.classList.add('focus-segment');

        segDiv.addEventListener('mouseenter', e => this.showTooltip(seg, e));
        segDiv.addEventListener('mousemove', e => this.moveTooltip(e));
        segDiv.addEventListener('mouseleave', () => this.hideTooltip());

        box.appendChild(segDiv);
        box.segments.push({ start: seg.start.getTime(), end: seg.end.getTime(), domElement: segDiv });
    });

    return box;
};

TimelineWidget.prototype._splitSegmentsByFocus = function(tabStart, tabEnd, payload, focusIntervals) {
    const segments = [];
    let lastTime = tabStart;

    focusIntervals.forEach(focus => {
        const focusStart = focus.startTime < tabStart ? tabStart : focus.startTime;
        const focusEnd = focus.endTime > tabEnd ? tabEnd : focus.endTime;
        if (focusEnd <= focusStart) return;

        if (focusStart > lastTime) {
            segments.push({ start: lastTime, end: focusStart, payload, isFocus: false, duration: (focusStart - lastTime) / 1000 });
        }
        segments.push({ start: focusStart, end: focusEnd, payload: 'Lost Focus', isFocus: true, duration: (focusEnd - focusStart) / 1000 });
        lastTime = focusEnd;
    });

    if (lastTime < tabEnd) {
        segments.push({ start: lastTime, end: tabEnd, payload, isFocus: false, duration: (tabEnd - lastTime) / 1000 });
    }

    return segments;
};

TimelineWidget.prototype._createEventLine = function(ev, timeline) {
    const parentBox = this._findParentBoxForEvent(ev, timeline);
    if (!parentBox) return;

    const line = document.createElement('div');
    line.className = 'event-line';
    Object.assign(line.style, { position: 'absolute', width: '2px', top: '-80px', backgroundColor: this.getColor(ev.event_type, ev.payload) || '#333' });
    line.parentBoxRef = parentBox;
    line.dataset.eventTime = new Date(ev.time_stamp).getTime();

    line.addEventListener('mouseenter', e => {
        this.tooltip.style.display = 'block';
        this.tooltip.innerText = `${ev.event_type}\nPayload: ${ev.payload ?? 'No payload'}\nTime: ${new Date(ev.time_stamp).toLocaleTimeString()}`;
    });
    line.addEventListener('mousemove', e => this.moveTooltip(e));
    line.addEventListener('mouseleave', () => this.hideTooltip());

    this.timelineDiv.appendChild(line);
    this.eventLines.push(line);
};

TimelineWidget.prototype._createFocusLines = function(focus, timeline) {
    const parentBox = timeline.filter(e => e.event_type === 'Tabpage').find(tab => {
        const tabStart = new Date(tab.time_stamp);
        const tabEnd = new Date(tabStart.getTime() + tab.durationSeconds * 1000);
        return focus.startTime < tabEnd && focus.endTime > tabStart;
    });

    if (!parentBox) return;
    const box = this.tabEventMap[parentBox.event_number];
    if (!box) return;

    [focus.startTime.getTime(), focus.endTime.getTime()].forEach(timestamp => {
        const line = document.createElement('div');
        line.className = 'event-line focus-line';
        Object.assign(line.style, { position: 'absolute', width: '2px', backgroundColor: '#000', top: '-100px' });
        line.parentBoxRef = box;
        line.dataset.eventTime = timestamp;

        line.addEventListener('mouseenter', e => {
            this.tooltip.style.display = 'block';
            this.tooltip.innerText = `Focus Line\nTime: ${new Date(timestamp).toLocaleTimeString()}`;
        });
        line.addEventListener('mousemove', e => this.moveTooltip(e));
        line.addEventListener('mouseleave', () => this.hideTooltip());

        this.timelineDiv.appendChild(line);
        this.focusLines.push(line);
    });
};

TimelineWidget.prototype._findParentBoxForEvent = function(ev, timeline) {
    const tabEvent = timeline.slice(0, timeline.indexOf(ev)).reverse().find(e => e.event_type === 'Tabpage');
    if (!tabEvent) return null;
    return this.tabEventMap[tabEvent.event_number] || null;
};


// ------------------------- TOOLTIP HANDLERS -------------------------
TimelineWidget.prototype.showTooltip = function(seg, e) {
    this.tooltip.style.display = 'block';
    this.tooltip.innerText = `${seg.payload}\nStart: ${new Date(seg.start).toLocaleTimeString()}\nEnd: ${new Date(seg.end).toLocaleTimeString()}\nDuration: ${this.formatDuration((seg.end - seg.start) / 1000)}`;
};

TimelineWidget.prototype.moveTooltip = function(e) {
    this.tooltip.style.left = e.pageX + 10 + 'px';
    this.tooltip.style.top = e.pageY + 10 + 'px';
};

TimelineWidget.prototype.hideTooltip = function() {
    this.tooltip.style.display = 'none';
};

// ------------------------- ZOOM & LINE POSITIONING -------------------------
TimelineWidget.prototype.applyZoom = function(factor) {
    this.zoomFactor = Math.min(Math.max(factor, this.MIN_ZOOM), this.MAX_ZOOM);
    Object.values(this.tabEventMap).forEach(box => {
        let totalWidth = 0;
        box.segments.forEach(seg => {
            if (seg.domElement.classList.contains('focus-segment') && !this.showFocus) {
                seg.domElement.style.width = '10px';
                seg.domElement.innerText = '';
            } else {
                seg.domElement.style.width = seg.domElement.dataset.originalWidth * this.zoomFactor + 'px';
                if (seg.domElement.classList.contains('focus-segment')) seg.domElement.innerText = 'Lost';
            }
            totalWidth += parseFloat(seg.domElement.style.width);
        });
        box.style.width = totalWidth + 'px';
    });
    this.updateEventLines();
};

TimelineWidget.prototype.updateEventLines = function() {
    const timelineRect = this.timelineDiv.getBoundingClientRect();
    [...this.eventLines, ...this.focusLines].forEach(line => {
        const parentBox = line.parentBoxRef;
        if (!parentBox) return;

        const boxRect = parentBox.getBoundingClientRect();
        const eventTime = parseInt(line.dataset.eventTime, 10);
        let leftWithinBox = 0;
        let foundSegment = null;

        for (const seg of parentBox.segments) {
            if (eventTime >= seg.start && eventTime <= seg.end) { foundSegment = seg; break; }
            leftWithinBox += seg.domElement.offsetWidth;
        }

        if (foundSegment) {
            const timeIntoSeg = eventTime - foundSegment.start;
            const segDuration = foundSegment.end - foundSegment.start;
            leftWithinBox += segDuration > 0 ? (timeIntoSeg / segDuration) * foundSegment.domElement.offsetWidth : 0;
        }

        const leftPos = (boxRect.left - timelineRect.left) + leftWithinBox;
        line.style.left = `${leftPos}px`;
        line.style.height = line.classList.contains('focus-line') ? `${parentBox.offsetHeight + 100}px` : `${parentBox.offsetHeight + 80}px`;
    });
};

// ------------------------- COLOR MAPPING -------------------------
TimelineWidget.prototype.getColor = function(eventType, payload) {
    if (payload === 'Lost Focus') return '#888';
    const key = payload ? `${eventType}-${JSON.stringify(payload)}` : `${eventType}-null`;
    if (!this.colorMap[key]) {
        const hue = (Object.keys(this.colorMap).length * 100) % 360;
        this.colorMap[key] = payload ? `hsl(${hue},50%,40%)` : '#666';
    }
    return this.colorMap[key];
};

// ------------------------- DURATION FORMAT -------------------------
TimelineWidget.prototype.formatDuration = function(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
