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
    } else { // datetime-local
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


export function applyHeatmap(tableSelector, startCol=1, endColOverride=null) {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    if (!rows.length) return;

    const colCount = rows[0].children.length;
    const endCol = endColOverride ?? colCount;

    for (let col = startCol; col < endCol; col++) {
        const values = rows.map(r => parseFloat(r.children[col].textContent) || 0);
        const maxVal = Math.max(...values);
        rows.forEach(r => {
            const val = parseFloat(r.children[col].textContent) || 0;
            const intensity = maxVal ? val / maxVal : 0;
            const lightGreen = Math.floor(255 - intensity * 155);
            r.children[col].style.backgroundColor = `rgb(${lightGreen},255,${lightGreen})`;
        });
    }
}


export function sortTableByRow(table, row, sortStateObj, startCol=1, endColOverride=null) {
    const key = row.dataset.tab ?? row.dataset.operation;
    if(!sortStateObj[key]) sortStateObj[key] = 0;
    sortStateObj[key] = (sortStateObj[key]+1)%3;
    const state = sortStateObj[key];

    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const header = table.querySelector("thead tr");
    const totalCols = header.children.length;
    const start = startCol;
    const end = endColOverride ?? totalCols;

    const values = Array.from(row.children).slice(start,end-2).map(td => parseFloat(td.textContent));
    let sortedIndexes = values.map((_,i)=>i);

    if(state===1) sortedIndexes.sort((a,b)=>values[b]-values[a]);
    if(state===2) sortedIndexes.sort((a,b)=>values[a]-values[b]);
    if(state===0) sortedIndexes.sort((a,b)=>{
        const labelA = header.children[a+1].textContent.toLowerCase();
        const labelB = header.children[b+1].textContent.toLowerCase();
        return labelA.localeCompare(labelB);
    });

    rows.forEach(r=>{
        const cells = Array.from(r.children);
        const first = cells[0];
        const lastTwo = cells.slice(-2);
        const middle = sortedIndexes.map(i=>cells[i+1]);
        r.innerHTML = "";
        r.appendChild(first);
        middle.forEach(c=>r.appendChild(c));
        lastTwo.forEach(c=>r.appendChild(c));
    });

    const headerCells = Array.from(header.children);
    const firstHeader = headerCells[0];
    const lastTwoHeader = headerCells.slice(-2);
    const middleHeader = sortedIndexes.map(i=>headerCells[i+1]);
    header.innerHTML = "";
    header.appendChild(firstHeader);
    middleHeader.forEach(c=>header.appendChild(c));
    lastTwoHeader.forEach(c=>header.appendChild(c));
}


export function renderBarChart(canvas, labels, data, colors, options={}) {
    if(canvas.chartInstance) canvas.chartInstance.destroy();
    canvas.chartInstance = new Chart(canvas, {
        type:'bar',
        data:{labels, datasets:[{data, backgroundColor: colors}]},
        options
    });
}