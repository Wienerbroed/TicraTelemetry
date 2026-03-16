// ---------------------------- FULL TIMELINE WITH FOCUS SEGMENTS & LINES ----------------------------
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
    timelineDiv.style.flexWrap = 'nowrap';

    const colorMap = {};
    let zoomFactor = 1;
    const ZOOM_STEP = 0.2;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 10;
    let showFocus = true;

    let eventLines = [];
    let focusLines = [];

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

        const MIN_TOTAL_WIDTH = 1200;
        const timelineTotalWidth = Math.max(data.timeline.length * 50, MIN_TOTAL_WIDTH);
        const tabEventMap = {};

        // ------------------- EXTRACT FOCUS PERIODS -------------------
        const focusIntervals = [];
        let lostFocusEvent = null;

        data.timeline.forEach(ev => {
            if (ev.event_type === 'Focus') {
                if (ev.payload === 'Lost Focus') lostFocusEvent = ev;
                else if (ev.payload === 'Got Focus' && lostFocusEvent) {
                    focusIntervals.push({
                        startTime: new Date(lostFocusEvent.time_stamp),
                        endTime: new Date(ev.time_stamp)
                    });
                    lostFocusEvent = null;
                }
            }
        });

        // ------------------- CREATE TABPAGE BOXES WITH INTERNAL SEGMENTS -------------------
        data.timeline.forEach(ev => {
            if (ev.event_type !== 'Tabpage') return;

            const box = document.createElement('div');
            box.className = 'event-box';
            box.dataset.startTime = new Date(ev.time_stamp).getTime();
            box.dataset.durationSeconds = ev.durationSeconds;
            box.style.position = 'relative';
            box.style.display = 'flex';
            box.style.flexDirection = 'row';
            box.style.marginRight = '0px';
            box.style.flexShrink = 0;

            const tabStart = new Date(ev.time_stamp);
            const tabEnd = new Date(tabStart.getTime() + ev.durationSeconds * 1000);

            const segments = [];
            let lastTime = tabStart;

            focusIntervals.forEach(focus => {
                const focusStart = focus.startTime < tabStart ? tabStart : focus.startTime;
                const focusEnd = focus.endTime > tabEnd ? tabEnd : focus.endTime;
                if (focusEnd <= focusStart) return;

                if (focusStart > lastTime) {
                    segments.push({ start: lastTime, end: focusStart, payload: ev.payload, isFocus: false });
                }

                segments.push({ start: focusStart, end: focusEnd, payload: 'Lost Focus', isFocus: true });
                lastTime = focusEnd;
            });

            if (lastTime < tabEnd) {
                segments.push({ start: lastTime, end: tabEnd, payload: ev.payload, isFocus: false });
            }

            let totalSegmentWidth = 0;

            segments.forEach(seg => {
                const segDuration = (seg.end - seg.start) / 1000;
                const segWidth = Math.max((segDuration / data.totalDurationSeconds) * timelineTotalWidth, 2);
                seg.domWidth = segWidth;
                totalSegmentWidth += segWidth;
            });

            box.style.width = totalSegmentWidth + 'px';
            box.originalWidth = totalSegmentWidth;
            box.segments = [];

            segments.forEach(seg => {
                const segDiv = document.createElement('div');
                segDiv.style.width = seg.domWidth + 'px';
                segDiv.dataset.originalWidth = seg.domWidth;
                segDiv.style.height = '100%';
                segDiv.style.display = 'flex';
                segDiv.style.justifyContent = 'center';
                segDiv.style.alignItems = 'center';
                segDiv.style.fontSize = '12px';
                segDiv.style.color = '#fff';
                segDiv.style.borderRadius = '4px';
                segDiv.style.overflow = 'hidden';
                segDiv.style.whiteSpace = 'nowrap';
                segDiv.style.textOverflow = 'ellipsis';
                segDiv.innerText = seg.payload;

                if (seg.isFocus) {
                    segDiv.style.backgroundColor = '#888';
                    segDiv.classList.add('focus-segment');
                    segDiv.innerText = 'Lost';
                } else {
                    segDiv.style.backgroundColor = getColor(ev.event_type, seg.payload);
                }

                segDiv.addEventListener('mouseenter', e => {
                    tooltip.style.display = 'block';
                    tooltip.innerText = `${seg.payload}\nStart: ${seg.start.toLocaleTimeString()}\nEnd: ${seg.end.toLocaleTimeString()}\nDuration: ${formatDuration((seg.end-seg.start)/1000)}`;
                });

                segDiv.addEventListener('mousemove', e => {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                });

                segDiv.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });

                box.appendChild(segDiv);

                box.segments.push({
                    start: seg.start.getTime(),
                    end: seg.end.getTime(),
                    domElement: segDiv
                });
            });

            timelineDiv.appendChild(box);
            tabEventMap[ev.event_number] = box;
        });

        // ------------------- OTHER EVENT LINES -------------------
        eventLines = [];

        data.timeline.forEach(ev => {
            if (ev.event_type !== 'Tabpage' && ev.event_type !== 'Focus') {

                const tabEvent = data.timeline
                    .slice(0, data.timeline.indexOf(ev))
                    .reverse()
                    .find(e => e.event_type === 'Tabpage');

                if (!tabEvent) return;

                const parentBox = tabEventMap[tabEvent.event_number];
                if (!parentBox) return;

                const line = document.createElement('div');
                line.className = 'event-line';
                line.style.position = 'absolute';
                line.style.width = '2px';
                line.style.backgroundColor = getColor(ev.event_type, ev.payload) || '#333';
                line.parentBoxRef = parentBox;
                line.dataset.eventTime = new Date(ev.time_stamp).getTime();
                line.style.top = '-50px';

                line.addEventListener('mouseenter', e => {
                    tooltip.style.display = 'block';
                    tooltip.innerText = `${ev.event_type}\nPayload: ${ev.payload ?? 'No payload'}\nTime: ${new Date(ev.time_stamp).toLocaleTimeString()}`;
                });

                line.addEventListener('mousemove', e => {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                });

                line.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });

                timelineDiv.appendChild(line);
                eventLines.push(line);
            }
        });

        // ------------------- FOCUS LINES -------------------
        focusLines = [];

        focusIntervals.forEach(focus => {

            const tabEvent = data.timeline
                .filter(e => e.event_type === 'Tabpage')
                .find(tab => {
                    const tabStart = new Date(tab.time_stamp);
                    const tabEnd = new Date(tabStart.getTime() + tab.durationSeconds * 1000);
                    return focus.startTime < tabEnd && focus.endTime > tabStart;
                });

            if (!tabEvent) return;

            const parentBox = tabEventMap[tabEvent.event_number];
            if (!parentBox) return;

            const createFocusLine = timestamp => {

                const line = document.createElement('div');
                line.className = 'event-line focus-line';
                line.style.position = 'absolute';
                line.style.width = '2px';
                line.style.backgroundColor = '#000';
                line.style.top = '-70px';
                line.parentBoxRef = parentBox;
                line.dataset.eventTime = timestamp;

                line.addEventListener('mouseenter', e => {
                    tooltip.style.display = 'block';
                    tooltip.innerText = `Focus Line\nTime: ${new Date(timestamp).toLocaleTimeString()}`;
                });

                line.addEventListener('mousemove', e => {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                });

                line.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });

                timelineDiv.appendChild(line);
                focusLines.push(line);
            };

            createFocusLine(focus.startTime.getTime());
            createFocusLine(focus.endTime.getTime());
        });

        // ------------------- UPDATE EVENT LINES (ALIGNMENT FIX) -------------------
        function updateEventLines() {

            const timelineRect = timelineDiv.getBoundingClientRect();

            [...eventLines, ...focusLines].forEach(line => {

                const parentBox = line.parentBoxRef;
                if (!parentBox) return;

                const boxRect = parentBox.getBoundingClientRect();
                const eventTime = parseInt(line.dataset.eventTime, 10);

                let leftWithinBox = 0;
                let foundSegment = null;

                for (const seg of parentBox.segments) {

                    if (eventTime >= seg.start && eventTime <= seg.end) {
                        foundSegment = seg;
                        break;
                    }

                    leftWithinBox += seg.domElement.offsetWidth;
                }

                if (foundSegment) {
                    const segDuration = foundSegment.end - foundSegment.start;
                    const timeIntoSeg = eventTime - foundSegment.start;
                    const relativePos = segDuration > 0 ? (timeIntoSeg / segDuration) : 0;
                    leftWithinBox += relativePos * foundSegment.domElement.offsetWidth;
                }

                const leftPos = (boxRect.left - timelineRect.left) + leftWithinBox;

                line.style.left = `${leftPos}px`;

                line.style.height = line.classList.contains('focus-line')
                    ? `${parentBox.offsetHeight + 70}px`
                    : `${parentBox.offsetHeight + 50}px`;
            });
        }

        // ------------------- ZOOM -------------------
        const applyZoom = () => {

            Object.values(tabEventMap).forEach(box => {

                let totalWidth = 0;

                box.segments.forEach(seg => {

                    if (seg.domElement.classList.contains('focus-segment') && !showFocus) {
                        seg.domElement.style.width = '10px';
                    } else {
                        seg.domElement.style.width = seg.domElement.dataset.originalWidth * zoomFactor + 'px';
                    }

                    totalWidth += parseFloat(seg.domElement.style.width);
                });

                box.style.width = totalWidth + 'px';
            });

            updateEventLines();
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

        // ------------------- FOCUS TOGGLE -------------------
        document.getElementById('toggleFocusBtn').addEventListener('click', () => {

            showFocus = !showFocus;

            Object.values(tabEventMap).forEach(box => {

                let totalWidth = 0;

                box.segments.forEach(seg => {

                    if (seg.domElement.classList.contains('focus-segment') && !showFocus) {
                        seg.domElement.style.width = '10px';
                        seg.domElement.innerText = '';
                    } else {
                        seg.domElement.style.width = seg.domElement.dataset.originalWidth * zoomFactor + 'px';

                        if (seg.domElement.classList.contains('focus-segment')) {
                            seg.domElement.innerText = 'Lost';
                        }
                    }

                    totalWidth += parseFloat(seg.domElement.style.width);
                });

                box.style.width = totalWidth + 'px';
            });

            updateEventLines();
        });

        updateEventLines();

    } catch (err) {
        console.error("Failed to load timeline:", err);
        timelineSummary.innerHTML = '<p>Unable to load timeline.</p>';
    }

    function getColor(eventType, payload){
        if(payload === 'Lost Focus') return '#888';

        const key = payload
            ? `${eventType}-${JSON.stringify(payload)}`
            : `${eventType}-null`;

        if(!colorMap[key]){
            const hue = (Object.keys(colorMap).length * 100) % 360;
            colorMap[key] = payload
                ? `hsl(${hue},50%,40%)`
                : "#666";
        }

        return colorMap[key];
    }
}