// scripts/sessionCharts.js
import { renderBarChart, COLORS } from './utils.js';

export function renderSessionCharts(STATE, perUser, tabs, columns, selectedEmployee=null, isType=false) {
    const chartContainer = document.getElementById('multiChartContainer');
    chartContainer.innerHTML = '';
    chartContainer.style.display = 'grid';
    chartContainer.style.gridTemplateColumns = 'repeat(2,1fr)';
    chartContainer.style.gap = '20px';

    columns.forEach(col => {
        const chartWrapper = document.createElement('div');
        chartWrapper.style.border = '1px solid #ddd';
        chartWrapper.style.borderRadius = '6px';
        chartWrapper.style.padding = '10px';
        chartWrapper.style.background = '#fafafa';
        chartWrapper.style.display = 'flex';
        chartWrapper.style.flexDirection = 'column';
        chartWrapper.style.alignItems = 'center';

        const title = document.createElement('strong');
        title.textContent = col;
        chartWrapper.appendChild(title);

        const toggleWrapper = document.createElement('label');
        toggleWrapper.style.fontSize = '12px';
        toggleWrapper.style.margin = '5px 0';
        toggleWrapper.innerHTML = `<input type="checkbox"> Show as %`;
        chartWrapper.appendChild(toggleWrapper);

        const percentageCheckbox = toggleWrapper.querySelector('input');

        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '260px';
        chartWrapper.appendChild(canvas);

        chartContainer.appendChild(chartWrapper);

        const renderChart = () => {
            const labels = tabs;
            let data = tabs.map(tab => {
                if (selectedEmployee && !isType) {
                    return STATE.fullSessions.filter(s => s.session_id === col && s.tab === tab)
                        .reduce((a, b) => a + b.durationSeconds, 0);
                } else {
                    return perUser[col]?.filter(s => s.tab === tab).reduce((a, b) => a + b.durationSeconds, 0) || 0;
                }
            });

            if (percentageCheckbox.checked) {
                const total = data.reduce((a, b) => a + b, 1);
                data = data.map(d => (d / total * 100).toFixed(2));
            }

            renderBarChart(canvas, labels, data, COLORS.slice(0, labels.length), {
                responsive: true,
                animation: false,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: percentageCheckbox.checked ? 100 : undefined,
                        title: { display: true, text: percentageCheckbox.checked ? 'Percentage (%)' : 'Seconds' }
                    }
                }
            });
        };

        percentageCheckbox.addEventListener('change', renderChart);
        renderChart();
    });
}