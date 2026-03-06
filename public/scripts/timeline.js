// ---------------------------- UPDATED TIMELINE FUNCTION ----------------------------
export async function loadTimeline(sessionId) {
    const timelineContainer = document.getElementById('timelineContainer');
    const timelineDiv = document.getElementById('timeline');
    const timelineLegend = document.getElementById('timelineLegend');
    const timelineSummary = document.getElementById('timelineSummary');
    const tooltip = document.getElementById('tooltip');

    timelineContainer.style.display = 'block';
    timelineDiv.innerHTML = timelineLegend.innerHTML = timelineSummary.innerHTML = '';
    timelineDiv.style.position = 'relative';
    timelineDiv.style.display = 'flex';
    timelineDiv.style.alignItems = 'flex-start';

    const colorMap = {};
    let zoomFactor = 1;
    const ZOOM_STEP = 0.2;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 10;

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

        // Create Tabpage boxes
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
                box.style.position = 'relative';
                box.style.marginRight = '2px';
                box.style.flexShrink = 0;

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

        // Create lines for other events
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
                line.style.width = '2px'; // fixed width
                line.style.height = `${parentBox.offsetHeight + 50}px`;
                line.parentBoxRef = parentBox; // store reference
                line.dataset.eventTime = new Date(ev.time_stamp).getTime();

                line.style.top = `-50px`;

                const updateLinePosition = () => {
                    const boxWidth = parentBox.offsetWidth * zoomFactor;
                    const boxStartTime = parseInt(parentBox.dataset.startTime, 10);
                    const boxEndTime = boxStartTime + parseInt(parentBox.dataset.durationSeconds, 10) * 1000;
                    const percent = Math.min(Math.max((line.dataset.eventTime - boxStartTime) / (boxEndTime - boxStartTime), 0), 1);
                    line.style.left = `${parentBox.offsetLeft * zoomFactor + percent * boxWidth}px`;
                };

                updateLinePosition(); // initial position

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

        // Create legend
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

        // Zoom functions
        const applyZoom = () => {
            timelineDiv.style.transform = `scaleX(${zoomFactor})`;
            timelineDiv.style.transformOrigin = 'left center';

            // reposition lines
            document.querySelectorAll('.event-line').forEach(line => {
                const parentBox = line.parentBoxRef;
                const boxWidth = parentBox.offsetWidth * zoomFactor;
                const boxStartTime = parseInt(parentBox.dataset.startTime, 10);
                const boxEndTime = boxStartTime + parseInt(parentBox.dataset.durationSeconds, 10) * 1000;
                const percent = Math.min(Math.max((line.dataset.eventTime - boxStartTime) / (boxEndTime - boxStartTime), 0), 1);
                line.style.left = `${parentBox.offsetLeft * zoomFactor + percent * boxWidth}px`;
            });
        };

        document.getElementById('zoomInBtn').addEventListener('click', () => {
            zoomFactor = Math.min(zoomFactor + ZOOM_STEP, MAX_ZOOM);
            applyZoom();
        });

        document.getElementById('zoomOutBtn').addEventListener('click', () => {
            zoomFactor = Math.max(zoomFactor - ZOOM_STEP, MIN_ZOOM);
            applyZoom();
        });

        document.getElementById('zoomResetBtn').addEventListener('click', () => {
            zoomFactor = 1;
            applyZoom();
        });

    } catch (err) {
        console.error("Failed to load timeline:", err);
        timelineSummary.innerHTML = '<p>Unable to load timeline.</p>';
    }

    function getColor(eventType, payload){
        const key = payload ? `${eventType}-${JSON.stringify(payload)}` : `${eventType}-null`;
        if(!colorMap[key]){
            const hue = (Object.keys(colorMap).length * 100) % 360;
            colorMap[key] = payload ? `hsl(${hue},50%,40%)` : "#888";
        }
        return colorMap[key];
    }
}