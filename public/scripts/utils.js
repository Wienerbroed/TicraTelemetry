// utils.js

export const COLORS = ['#4caf50','#2196f3','#ff9800','#f44336','#9c27b0','#00bcd4','#ffeb3b','#795548'];

// ---------------- DATE HELPERS ----------------
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

// ---------------- FETCH ----------------
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

// ---------------- TABLE CELL HELPERS ----------------
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

// ---------------- CHARTS ----------------
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
    container.style.gridTemplateColumns = 'repeat(2, 1fr)';
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
                    interaction: { mode: 'index', axis: 'x', intersect: false }
                }
            );
        };

        percentageCheckbox.addEventListener('change', renderChart);
        renderChart();
    });
}

// ---------------- STICKY COLUMNS ----------------
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

// ---------------- TABLE SORTING ----------------
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

// ---------------- UTILITY ----------------
export function formatSecondsToHMS(sec){
    const h = Math.floor(sec/3600).toString().padStart(2,'0');
    const m = Math.floor((sec%3600)/60).toString().padStart(2,'0');
    const s = Math.floor(sec%60).toString().padStart(2,'0');
    return `${h}:${m}:${s}`;
}

export function createRotatedHeader(text, sticky=false, isUser=false){
    const th = document.createElement("th");
    th.classList.add("rotate");
    if(sticky) th.classList.add("sticky");
    if(isUser) th.classList.add("user-cell");
    const div = document.createElement("div");
    div.textContent = text;
    th.appendChild(div);
    return th;
}

export function applyColumnHeatmap(table){
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (!rows.length) return;

    const headerCells = table.querySelectorAll('thead th');
    let firstUserColIndex = 0;
    for (let i = 0; i < headerCells.length; i++) {
        if (headerCells[i].classList.contains('user-cell')) {
            firstUserColIndex = i;
            break;
        }
    }

    for (let col = firstUserColIndex; col < headerCells.length; col++) {
        const values = rows.map(r => parseFloat(r.children[col].dataset.sort)||0);
        const maxVal = Math.max(...values);
        rows.forEach(r=>{
            const td = r.children[col];
            td.classList.remove('heatmap-max');
            if(td.dataset.sort && parseFloat(td.dataset.sort)===maxVal && maxVal>0) td.classList.add('heatmap-max');
        });
    }
}

export function attachSortableRows(table, sortState){
    const headerCells = table.querySelectorAll('thead th');
    let firstDataColIndex = 0;
    for(let i=0;i<headerCells.length;i++){
        if(headerCells[i].classList.contains('user-cell')){
            firstDataColIndex=i;
            break;
        }
    }
    table.querySelectorAll('tbody tr').forEach(tr=>{
        tr.classList.add('sortable');
        tr.addEventListener('click',()=>{
            sortTableByRow(table,tr,sortState,firstDataColIndex); 
            applyColumnHeatmap(table);
        });
    });
}

export function downloadTableAsCSV(table){
    if (!table) return;
    const rows = [];
    table.querySelectorAll('thead tr, tbody tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('th, td'));
        rows.push(cells.map(c => c.innerText).join(';'));
    });
    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'session_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function u_type_matches(userName, typeName){
    return true;
}
