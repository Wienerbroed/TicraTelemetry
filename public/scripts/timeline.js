// ---------------------------- NEW TIMELINE FUNCTION ----------------------------
export async function loadTimeline(sessionId) {
    const timelineContainer = document.getElementById('timelineContainer');
    const timelineDiv = document.getElementById('timeline');
    const timelineLegend = document.getElementById('timelineLegend');
    const timelineSummary = document.getElementById('timelineSummary');
    const tooltip = document.getElementById('tooltip');

    timelineContainer.style.display = 'block';
    timelineDiv.innerHTML = timelineLegend.innerHTML = timelineSummary.innerHTML = '';
    const colorMap={};
    timelineDiv.style.position = 'relative';

    try {
        const response = await fetch(`/sessionTimeline?sessionId=${sessionId}`);
        const data = await response.json();
        if (!data.timeline?.length) {
            timelineSummary.innerHTML = '<p>No events found for this session.</p>';
            return;
        }

        function formatDuration(seconds) {
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
        }

        const timestamps = data.timeline.map(ev => new Date(ev.time_stamp)).filter(Boolean);
        const startTime = timestamps.length ? new Date(Math.min(...timestamps)) : null;
        const endTime = timestamps.length ? new Date(Math.max(...timestamps)) : null;

        timelineSummary.innerHTML = `
            <div class="summary">
                <strong>Session ID:</strong> ${data.sessionId}<br/>
                <strong>User:</strong> ${data.user_name}<br/>
                <strong>Employee Type:</strong> ${data.employee_type}<br/>
                <strong>Total Events:</strong> ${data.totalEvents}<br/>
                <strong>Duration:</strong> ${startTime?.toLocaleString() ?? 'N/A'} - ${endTime?.toLocaleString() ?? 'N/A'} (Total time spent: ${formatDuration(data.totalDurationSeconds)})
            </div>
        `;

        const totalDuration = data.totalDurationSeconds || 1;
        const MIN_TOTAL_WIDTH = 1200;
        const timelineTotalWidth = Math.max(data.timeline.length * 50, MIN_TOTAL_WIDTH);

        const tabEventMap = {};
        data.timeline.forEach(ev => {
            if (ev.event_type === 'Tabpage') {
                const box = document.createElement('div');
                box.className = 'event-box';
                box.dataset.eventNumber = ev.event_number;
                box.dataset.startTime = new Date(ev.time_stamp).getTime();
                box.dataset.durationSeconds = ev.durationSeconds;

                const width = Math.max((ev.durationSeconds / totalDuration) * timelineTotalWidth, 20);
                box.style.width = width + 'px';
                box.style.backgroundColor = getColor(ev.event_type, ev.payload) || '#666';

                const text = document.createElement('div');
                text.className = 'tabpage-text';
                text.innerText = ev.payload ?? '';
                box.appendChild(text);

                box.addEventListener('mouseenter', e => {
                    tooltip.style.display = 'block';
                    const startTimeStr = new Date(ev.time_stamp).toLocaleTimeString();
                    tooltip.innerText = `Tab: ${ev.payload ?? 'N/A'}\nStart Time: ${startTimeStr}\nTotal time spent: ${formatDuration(ev.durationSeconds)}`;
                });
                box.addEventListener('mousemove', e => {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                });
                box.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

                timelineDiv.appendChild(box);
                tabEventMap[ev.event_number] = box;
            }
        });

        data.timeline.forEach(ev => {
            if (ev.event_type !== 'Tabpage') {
                const tabEvent = data.timeline.slice(0, data.timeline.indexOf(ev)).reverse().find(e => e.event_type === 'Tabpage');
                if (!tabEvent) return;
                const parentBox = tabEventMap[tabEvent.event_number];
                if (!parentBox) return;

                const line = document.createElement('div');
                line.className = 'event-line';
                line.style.backgroundColor = getColor(ev.event_type, ev.payload) || '#333';
                line.style.position = 'absolute';

                const boxWidth = parentBox.offsetWidth;
                const boxStartTime = new Date(tabEvent.time_stamp).getTime();
                const boxEndTime = boxStartTime + tabEvent.durationSeconds * 1000;
                const eventTime = new Date(ev.time_stamp).getTime();
                const percent = Math.min(Math.max((eventTime - boxStartTime) / (boxEndTime - boxStartTime), 0), 1);

                line.style.left = `${parentBox.offsetLeft + percent * boxWidth}px`;
                line.style.top = `-50px`;
                line.style.width = '2px';
                line.style.height = `${parentBox.offsetHeight + 50}px`;

                line.addEventListener('mouseenter', e => {
                    tooltip.style.display = 'block';
                    tooltip.innerText = `${ev.event_type}\nPayload: ${ev.payload ?? 'None'}\nTime: ${new Date(ev.time_stamp).toLocaleTimeString()}`;
                });
                line.addEventListener('mousemove', e => {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                });
                line.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

                timelineDiv.appendChild(line);
            }
        });

        const grouped = {};
        Object.keys(colorMap).forEach(key => {
            const [type, payloadStr] = key.split(/-(.+)/);
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push({ key, payloadStr, color: colorMap[key] });
        });
        Object.keys(grouped).forEach(type => {
            const column = document.createElement('div');
            column.className = 'legend-column';
            const title = document.createElement('div');
            title.className = 'legend-title';
            title.innerText = type;
            column.appendChild(title);

            grouped[type].forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'legend-item';
                const colorBox = document.createElement('div');
                colorBox.className = 'legend-color';
                colorBox.style.backgroundColor = item.color;
                const label = document.createElement('span');
                label.innerText = item.payloadStr === 'null' ? 'No payload' : item.payloadStr;
                itemDiv.appendChild(colorBox);
                itemDiv.appendChild(label);
                column.appendChild(itemDiv);
            });

            timelineLegend.appendChild(column);
        });

        timelineContainer.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        console.error("Failed to load timeline:", err);
        timelineSummary.innerHTML = '<p>Unable to load timeline.</p>';
    }

    function getColor(eventType,payload){ const key=payload?`${eventType}-${JSON.stringify(payload)}`:`${eventType}-null`; if(!colorMap[key]){ const hue=(Object.keys(colorMap).length*100)%360; colorMap[key]=payload?`hsl(${hue},50%,40%)`:"#888"; } return colorMap[key]; }
}

const timelineDiv = document.getElementById('timeline');
let zoomFactor = 1;
const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

document.getElementById('zoomInBtn').addEventListener('click', () => {
    zoomFactor = Math.min(zoomFactor + ZOOM_STEP, MAX_ZOOM);
    timelineDiv.style.transform = `scaleX(${zoomFactor})`;
    timelineDiv.style.transformOrigin = 'left center';
});

document.getElementById('zoomOutBtn').addEventListener('click', () => {
    zoomFactor = Math.max(zoomFactor - ZOOM_STEP, MIN_ZOOM);
    timelineDiv.style.transform = `scaleX(${zoomFactor})`;
    timelineDiv.style.transformOrigin = 'left center';
});

document.getElementById('zoomResetBtn').addEventListener('click', () => {
    zoomFactor = 1;
    timelineDiv.style.transform = `scaleX(1)`;
});