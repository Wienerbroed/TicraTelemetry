export const COLORS = ['#4caf50','#2196f3','#ff9800','#f44336','#9c27b0','#00bcd4','#ffeb3b','#795548'];

export function setDefaultDateRange(startInputId, endInputId, daysBack=10) {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - daysBack);

    const startInput = document.getElementById(startInputId);
    const endInput = document.getElementById(endInputId);

    if(startInput.type === "date") {
        startInput.value = past.toISOString().split('T')[0];
        endInput.value = today.toISOString().split('T')[0];
    } else { 
        const pad = n => n.toString().padStart(2,'0');
        const formatDT = date => 
            `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        startInput.value = formatDT(past);
        endInput.value = formatDT(today);
    }
}

export async function fetchJson(url) {
    const res = await fetch(url);
    if(!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
}

export async function populateDropdown(selectId, url, defaultOption) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '';
    sel.appendChild(new Option(defaultOption, ''));
    try {
        const items = await fetchJson(url);
        items.forEach(item => sel.appendChild(new Option(item, item)));
    } catch (err) {
        console.error(`Failed to load dropdown ${selectId}`, err);
    }
}

export function createHeader(text, className=null) {
    const th = document.createElement('th');
    th.textContent = text;
    if(className) th.classList.add(className);
    return th;
}

export function createCell(value, bold=false, bg=null, className=null) {
    const td = document.createElement('td');
    td.textContent = value;
    if(bold) td.style.fontWeight = 'bold';
    if(bg) td.style.background = bg;
    td.style.textAlign = 'center';
    if(className) td.classList.add(className);
    return td;
}

export function applyHeatmap(selector, startCol=1, endColOverride=null) {
    const rows = Array.from(document.querySelectorAll(selector));
    if (!rows.length) return;

    const colCount = rows[0].children.length;
    const endCol = endColOverride ?? colCount;

    for (let col = startCol; col < endCol; col++) {
        const values = rows.map(r => parseFloat(r.children[col].textContent) || 0);
        const maxVal = Math.max(...values);

        rows.forEach(r => {
            const val = parseFloat(r.children[col].textContent) || 0;
            if (val > 0 && maxVal > 0) {
                const intensity = val / maxVal;
                r.children[col].style.backgroundColor = `rgba(0, 255, 0, ${intensity * 0.5})`;
            } else {
                r.children[col].style.backgroundColor = '';
            }
        });
    }
}

export function sortTableByRow(table, row, sortStateObj, startCol=1, endColOverride=null, nonSortableCount=0) {
    const key = row.dataset.tab ?? row.dataset.operation;
    if(!sortStateObj[key]) sortStateObj[key] = 0;
    sortStateObj[key] = (sortStateObj[key]+1)%3;
    const state = sortStateObj[key];

    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const header = table.querySelector("thead tr");
    const totalCols = header.children.length;
    const start = startCol + nonSortableCount;       
    const end = endColOverride ?? totalCols;

    // NEW: Use data-sort if available
    const values = Array.from(row.children).slice(start, end).map(td => {
        const ds = td.dataset.sort;
        if(ds !== undefined) return parseFloat(ds);
        return parseFloat(td.textContent) || 0;
    });

    let sortedIndexes = values.map((_, i) => i);

    if(state === 1) sortedIndexes.sort((a,b) => values[b] - values[a]);
    if(state === 2) sortedIndexes.sort((a,b) => values[a] - values[b]);
    if(state === 0) sortedIndexes.sort((a,b) => {
        const labelA = header.children[a+start].textContent.toLowerCase();
        const labelB = header.children[b+start].textContent.toLowerCase();
        return labelA.localeCompare(labelB);
    });

    rows.forEach(r => {
        const cells = Array.from(r.children);
        const left = cells.slice(0, start);
        const middle = sortedIndexes.map(i => cells[i+start]);
        const right = cells.slice(end);
        r.innerHTML = "";
        left.forEach(c => r.appendChild(c));
        middle.forEach(c => r.appendChild(c));
        right.forEach(c => r.appendChild(c));
    });

    const headerCells = Array.from(header.children);
    const leftHeader = headerCells.slice(0, start);
    const middleHeader = sortedIndexes.map(i => headerCells[i+start]);
    const rightHeader = headerCells.slice(end);
    header.innerHTML = "";
    leftHeader.forEach(c => header.appendChild(c));
    middleHeader.forEach(c => header.appendChild(c));
    rightHeader.forEach(c => header.appendChild(c));
}


export function renderBarChart(canvas, labels, data, colors, options={}) {
    if(canvas.chartInstance) canvas.chartInstance.destroy();
    canvas.chartInstance = new Chart(canvas, {
        type:'bar',
        data:{labels, datasets:[{data, backgroundColor: colors}]},
        options
    });
}

export function applyStickyColumns(table, numColumns = 3) {
    if (!table) return;

    const wrapper = table.closest('#tableContainerWrapper');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    const headers = [];
    const cellsPerColumn = [];

    for (let col = 0; col < numColumns; col++) {
        const header = thead.querySelector(`th:nth-child(${col+1})`);
        const cells = [...tbody.querySelectorAll(`td:nth-child(${col+1})`)];
        headers.push(header);
        cellsPerColumn.push(cells);

        header.style.backgroundColor = 'white';
        cells.forEach(td => td.style.backgroundColor = 'white');
    }

    function updateSticky() {
        let leftOffset = 0;

        for (let col = 0; col < numColumns; col++) {
            const header = headers[col];
            const cells = cellsPerColumn[col];

            header.style.position = 'sticky';
            header.style.left = `${leftOffset}px`;
            header.style.zIndex = 500;

            cells.forEach(td => {
                td.style.position = 'sticky';
                td.style.left = `${leftOffset}px`;
                td.style.zIndex = 400;
            });

            leftOffset += header.getBoundingClientRect().width;
        }
    }

    wrapper.addEventListener('scroll', updateSticky);
    window.addEventListener('resize', updateSticky);
    updateSticky();
}

// -------------------------
// NEW: Multiple charts helper
// -------------------------
export function renderMultipleBarCharts(container, perUser, eventTypeOrder, colors) {
    container.innerHTML = ''; // clear previous charts

    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(2, 1fr)'; // max 2 charts per row
    container.style.gap = '20px';

    eventTypeOrder.forEach((eventType, idx) => {
        // Gather all selections for this eventType across all users
        const selectionsSet = new Set();
        Object.values(perUser).forEach(userObj => {
            Object.keys(userObj)
                .filter(s => s.startsWith(eventType + '::'))
                .forEach(sel => selectionsSet.add(sel));
        });

        let selections = Array.from(selectionsSet);

        // Remove selections where all values are 0 or undefined
        selections = selections.filter(sel => {
            const total = Object.values(perUser).reduce((sum, u) => sum + (u[sel] ?? 0), 0);
            return total > 0;
        });

        if (selections.length === 0) return; // skip empty chart

        // Chart wrapper
        const chartWrapper = document.createElement('div');
        chartWrapper.style.display = 'flex';
        chartWrapper.style.flexDirection = 'column';
        chartWrapper.style.alignItems = 'center';
        chartWrapper.style.minHeight = '360px';
        chartWrapper.style.padding = '10px';
        chartWrapper.style.border = '1px solid #ddd';
        chartWrapper.style.borderRadius = '6px';
        chartWrapper.style.background = '#fafafa';

        // Chart title
        const title = document.createElement('strong');
        title.textContent = eventType;
        chartWrapper.appendChild(title);

        // Percentage toggle
        const toggleWrapper = document.createElement('label');
        toggleWrapper.style.margin = '5px 0';
        toggleWrapper.style.fontSize = '12px';
        toggleWrapper.innerHTML = `<input type="checkbox"> Show as %`;
        chartWrapper.appendChild(toggleWrapper);
        const percentageCheckbox = toggleWrapper.querySelector('input');

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.id = `chart_${idx}`;
        canvas.style.width = '100%';
        canvas.style.height = '260px';
        chartWrapper.appendChild(canvas);
        container.appendChild(chartWrapper);

        // Function to render chart based on toggle
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
                    interaction: { mode: 'index', axis: 'x', intersect: false }
                }
            );
        };

        percentageCheckbox.addEventListener('change', renderChart);
        renderChart();
    });
}



