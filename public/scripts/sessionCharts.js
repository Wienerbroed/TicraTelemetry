// sessionCharts.js
import { renderBarChart, createSlider } from './chartHelpers.js';
import { getColorForType } from './colors.js';

function formatSecondsToHMS(seconds) {
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    return [
        h.toString().padStart(2, '0'),
        m.toString().padStart(2, '0'),
        sec.toString().padStart(2, '0')
    ].join(':');
}

export function renderSessionCharts(
    STATE,
    perUser,
    tabs,
    columns,
    selectedEmployee = null,
    isType = false
) {
    const chartContainer = document.getElementById('multiChartContainer');
    chartContainer.innerHTML = '';
    chartContainer.style.display = 'grid';
    chartContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    chartContainer.style.gap = '20px';

    const modes = ['percent', 'seconds', 'hms'];
    const modeLabels = { percent: '%', seconds: 'Sec', hms: 'HH' };

    columns.forEach(col => {
        const chartWrapper = document.createElement('div');
        chartWrapper.style.border = '1px solid #ddd';
        chartWrapper.style.borderRadius = '6px';
        chartWrapper.style.padding = '10px';
        chartWrapper.style.background = '#fafafa';
        chartWrapper.style.display = 'flex';
        chartWrapper.style.flexDirection = 'column';
        chartWrapper.style.alignItems = 'center';

        // --- TITLE ---
        const title = document.createElement('strong');
        title.textContent = col;
        chartWrapper.appendChild(title);

        // --- SLIDER ---
        const sliderContainer = document.createElement('div');
        chartWrapper.appendChild(sliderContainer);

        // Create generalized slider
        const getCurrentModeIndex = createSlider(
            sliderContainer,
            [modeLabels.percent, modeLabels.seconds, modeLabels.hms],
            125,
            renderChart // callback on change
        );

        // --- CANVAS ---
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '260px';
        chartWrapper.appendChild(canvas);
        chartContainer.appendChild(chartWrapper);

        // --- RENDER CHART FUNCTION ---
        function renderChart() {
            const currentModeIndex = getCurrentModeIndex();
            const mode = modes[currentModeIndex];

            const rawData = tabs.map(tab => {
                if (selectedEmployee && !isType) {
                    return STATE.fullSessions
                        .filter(s => s.session_id === col && s.tab === tab)
                        .reduce((a, b) => a + b.durationSeconds, 0);
                } else {
                    return (
                        perUser[col]
                            ?.filter(s => s.tab === tab)
                            .reduce((a, b) => a + b.durationSeconds, 0) || 0
                    );
                }
            });

            let data;
            if (mode === 'percent') {
                const total = rawData.reduce((a, b) => a + b, 1);
                data = rawData.map(d => Math.round((d / total) * 100));
            } else {
                data = rawData.map(d => Math.round(d));
            }

            const colors = tabs.map(label => getColorForType(label));

            renderBarChart(canvas, tabs, data, colors, {
                responsive: true,
                animation: false,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.raw;
                                if (mode === 'percent') return value + '%';
                                if (mode === 'seconds') return value + ' sec';
                                return formatSecondsToHMS(value);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: mode === 'percent' ? 100 : undefined,
                        title: {
                            display: true,
                            text:
                                mode === 'percent'
                                    ? 'Percentage (%)'
                                    : mode === 'seconds'
                                    ? 'Seconds'
                                    : 'Time (HH:MM:SS)'
                        },
                        ticks: {
                            callback: function (value) {
                                const rounded = Math.round(value);
                                if (mode === 'percent') return rounded + '%';
                                if (mode === 'seconds') return rounded;
                                return formatSecondsToHMS(rounded);
                            }
                        }
                    }
                }
            });
        }

        // Initial render
        renderChart();
    });
}