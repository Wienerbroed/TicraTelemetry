// chartHelpers.js
export function renderBarChart(canvas, labels, data, colors, options={}) {
    if(canvas.chartInstance) canvas.chartInstance.destroy();
    canvas.chartInstance = new Chart(canvas, {
        type:'bar',
        data:{labels, datasets:[{data, backgroundColor: colors}]},
        options
    });
}

export function renderMultipleBarCharts(container, perUser, eventTypeOrder, colors) {
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

        let selections = Array.from(selectionsSet);

        selections = selections.filter(sel => {
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

        const toggleWrapper = document.createElement('label');
        toggleWrapper.style.margin = '5px 0';
        toggleWrapper.style.fontSize = '12px';
        toggleWrapper.innerHTML = `<input type="checkbox"> Show as %`;
        chartWrapper.appendChild(toggleWrapper);
        const percentageCheckbox = toggleWrapper.querySelector('input');

        const canvas = document.createElement('canvas');
        canvas.id = `chart_${idx}`;
        canvas.style.width = '100%';
        canvas.style.height = '260px';
        chartWrapper.appendChild(canvas);
        container.appendChild(chartWrapper);

        const renderChart = () => {
            const totals = selections.map(sel =>
                Object.values(perUser).reduce((sum, userObj) => sum + (userObj[sel] ?? 0), 0)
            );

            let displayData;
            if (percentageCheckbox.checked) {
                const totalSum = totals.reduce((a,b)=>a+b, 0) || 1;
                displayData = totals.map(t => ((t / totalSum) * 100).toFixed(2));
            } else {
                displayData = totals;
            }

            renderBarChart(
                canvas,
                selections.map(s => s.split('::')[1]),
                displayData,
                colors,
                {
                    responsive:true,
                    animation:false,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMin: 0,
                            max: percentageCheckbox.checked ? 100 : undefined,
                            title: { display: true, text: percentageCheckbox.checked ? 'Percentage (%)' : 'Count' },
                            ticks: { precision:0 }
                        },
                        x: { ticks: { autoSkip: false } }
                    },
                    layout: { padding: { top: 10, bottom: 5 } },
                    interaction: { mode: 'index', axis: 'x', intersect: false },
                    
                    plugins: { legend: { display: false } },
                }
            );
        };

        percentageCheckbox.addEventListener('change', renderChart);
        renderChart();
    });
}

