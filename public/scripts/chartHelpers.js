// chartHelpers.js
import { getColorForType } from './colors.js';

/**
 * Render a single bar chart on the given canvas
 */
export function renderBarChart(canvas, labels, data, colors, options = {}) {
    if (canvas.chartInstance) canvas.chartInstance.destroy();
    canvas.chartInstance = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: colors }] },
        options
    });
}

/**
 * Create a reusable slider with stops and labels above
 * @param {HTMLElement} container - Where the slider is rendered
 * @param {Array<string>} stops - Labels for each stop
 * @param {number} width - width in px
 * @param {function} onChange - callback(index) when selection changes
 */
export function createSlider(container, stops, width = 125, onChange) {
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = width + 'px';
    container.style.height = '60px';
    container.style.userSelect = 'none';

    // Track
    const track = document.createElement('div');
    track.style.position = 'absolute';
    track.style.top = '50%';
    track.style.left = '0';
    track.style.right = '0';
    track.style.height = '4px';
    track.style.background = '#ccc';
    track.style.transform = 'translateY(-50%)';
    track.style.borderRadius = '2px';
    container.appendChild(track);

    const stopPositions = stops.map((_, i) => i / (stops.length - 1));

    // Stop dots and labels
    stopPositions.forEach((pos, i) => {
        // Stop dot
        const dotStop = document.createElement('div');
        dotStop.style.position = 'absolute';
        dotStop.style.top = '50%';
        dotStop.style.left = `${pos * width}px`;
        dotStop.style.width = '14px';
        dotStop.style.height = '14px';
        dotStop.style.background = '#999';
        dotStop.style.borderRadius = '50%';
        dotStop.style.transform = 'translate(-50%, -50%)';
        dotStop.style.cursor = 'pointer';
        container.appendChild(dotStop);

        // Click on stop
        dotStop.addEventListener('click', () => {
            currentIndex = i;
            updateDot();
            if (onChange) onChange(currentIndex);
        });

        // Label
        const label = document.createElement('div');
        label.textContent = stops[i];
        label.style.position = 'absolute';
        label.style.top = '0';
        label.style.left = `${pos * width}px`;
        label.style.transform = 'translateX(-50%)';
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        container.appendChild(label);
    });

    // Draggable dot
    const dot = document.createElement('div');
    dot.style.position = 'absolute';
    dot.style.top = '50%';
    dot.style.left = '0px';
    dot.style.width = '16px';
    dot.style.height = '16px';
    dot.style.background = '#007bff';
    dot.style.borderRadius = '50%';
    dot.style.transform = 'translate(-50%, -50%)';
    dot.style.cursor = 'pointer';
    container.appendChild(dot);

    let currentIndex = 0;

    const updateDot = () => {
        dot.style.left = `${stopPositions[currentIndex] * width}px`;
    };

    // Drag logic
    let isDragging = false;
    const onMouseMove = e => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        if (x < 0) x = 0;
        if (x > width) x = width;
        dot.style.left = `${x}px`;
        // Snap to nearest stop
        const distances = stopPositions.map(pos => Math.abs(pos * width - x));
        currentIndex = distances.indexOf(Math.min(...distances));
        if (onChange) onChange(currentIndex);
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        snapDot();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };

    dot.addEventListener('mousedown', e => {
        isDragging = true;
        e.preventDefault();
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    const snapDot = () => {
        dot.style.left = `${stopPositions[currentIndex] * width}px`;
        if (onChange) onChange(currentIndex);
    };

    updateDot();

    return () => currentIndex; // getter for current index
}

/**
 * Render multiple bar charts with a slider for Count/% selection
 */
export function renderMultipleBarCharts(container, perUser, eventTypeOrder) {
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(4, 1fr)';
    container.style.gap = '20px';

    eventTypeOrder.forEach((eventType, idx) => {
        const selectionsSet = new Set();
        Object.values(perUser).forEach(userObj => {
            Object.keys(userObj)
                .filter(s => s.startsWith(eventType + '::'))
                .forEach(sel => selectionsSet.add(sel));
        });

        let selections = Array.from(selectionsSet).filter(sel => {
            const total = Object.values(perUser).reduce((sum, u) => sum + (u[sel] ?? 0), 0);
            return total > 0;
        });
        if (selections.length === 0) return;

        const chartWrapper = document.createElement('div');
        chartWrapper.style.display = 'flex';
        chartWrapper.style.flexDirection = 'column';
        chartWrapper.style.alignItems = 'center';
        chartWrapper.style.minHeight = '360px';
        chartWrapper.style.padding = '10px';
        chartWrapper.style.border = '1px solid #ddd';
        chartWrapper.style.borderRadius = '6px';
        chartWrapper.style.background = '#fafafa';

        const title = document.createElement('strong');
        title.textContent = eventType;
        chartWrapper.appendChild(title);

        // --- Slider container ---
        const sliderContainer = document.createElement('div');
        chartWrapper.appendChild(sliderContainer);
        const getCurrentIndex = createSlider(
            sliderContainer,
            ['Count', '%'],
            125,
            renderChart
        );

        const canvas = document.createElement('canvas');
        canvas.id = `chart_${idx}`;
        canvas.style.width = '100%';
        canvas.style.height = '260px';
        chartWrapper.appendChild(canvas);
        container.appendChild(chartWrapper);

        function renderChart() {
            const modeIndex = getCurrentIndex(); // 0=Count, 1=Percent
            const totals = selections.map(sel =>
                Object.values(perUser).reduce((sum, userObj) => sum + (userObj[sel] ?? 0), 0)
            );

            let displayData;
            if (modeIndex === 1) {
                const totalSum = totals.reduce((a, b) => a + b, 0) || 1;
                displayData = totals.map(t => ((t / totalSum) * 100).toFixed(2));
            } else {
                displayData = totals;
            }

            const colors = selections.map(s => getColorForType(s.split('::')[1]));

            renderBarChart(
                canvas,
                selections.map(s => s.split('::')[1]),
                displayData,
                colors,
                {
                    responsive: true,
                    animation: false,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMin: 0,
                            max: modeIndex === 1 ? 100 : undefined,
                            title: {
                                display: true,
                                text: modeIndex === 1 ? 'Percentage (%)' : 'Count'
                            },
                            ticks: { precision: 0 }
                        },
                        x: { ticks: { autoSkip: false } }
                    },
                    layout: { padding: { top: 10, bottom: 5 } },
                    interaction: { mode: 'index', axis: 'x', intersect: false },
                    plugins: { legend: { display: false } },
                }
            );
        }

        renderChart();
    });
}