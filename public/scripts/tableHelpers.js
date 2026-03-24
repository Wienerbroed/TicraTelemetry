// tableHelpers.js

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

// ---------------- CSV ----------------
export function downloadTableCSV(tableId = 'bigTable', filename = 'session_data.csv') {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = [];
    table.querySelectorAll('thead tr, tbody tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('th,td'));
        rows.push(cells.map(c => c.innerText.trim().replace(/[\r\n\t]+/g, ' ')).join(';'));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ---------------- STICKY ----------------
export function applyStickyColumns(table, numColumns = 0) {
    if (!table) return;

    // FIX: fallback to parent if wrapper doesn't exist (widgets!)
    const wrapper = table.closest('#tableContainerWrapper') || table.parentElement;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (!thead || !tbody) return;

    const headers = [];
    const cellsPerColumn = [];

    for (let col = 0; col < numColumns; col++) {
        const header = thead.querySelector(`th:nth-child(${col + 1})`);
        const cells = [...tbody.querySelectorAll(`td:nth-child(${col + 1})`)];

        if (!header) continue;

        headers.push(header);
        cellsPerColumn.push(cells);

        header.style.backgroundColor = '#fff';
        cells.forEach(td => td.style.backgroundColor = '#fff');
    }

    function updateSticky() {
        let leftOffset = 0;

        for (let col = 0; col < numColumns; col++) {
            const header = headers[col];
            const cells = cellsPerColumn[col];

            if (!header) continue;

            const width = header.getBoundingClientRect().width;

            header.style.position = 'sticky';
            header.style.left = `${leftOffset}px`;
            header.style.zIndex = 500;
            header.style.backgroundColor = '#fff';

            cells.forEach(td => {
                td.style.position = 'sticky';
                td.style.left = `${leftOffset}px`;
                td.style.zIndex = 400;
                td.style.backgroundColor = '#fff';
            });

            leftOffset += width;
        }
    }

    if (wrapper) {
        wrapper.addEventListener('scroll', updateSticky);
    }

    window.addEventListener('resize', updateSticky);

    updateSticky();
}

// ---------------- SORT ----------------
export function sortTableByRow(table, row, sortStateObj, startCol=1, endColOverride=null, nonSortableCount=0) {
    const key = row.dataset.tab ?? row.dataset.operation;

    if(!sortStateObj[key]) sortStateObj[key] = 0;
    sortStateObj[key] = (sortStateObj[key] + 1) % 3;

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

// ---------------- ROTATE / HEATMAP ----------------
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
    if (!tbody) return;

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
        const columnValues = rows.map(r => parseFloat(r.children[col].dataset.sort ?? r.children[col].textContent) || 0);
        const maxVal = Math.max(...columnValues);

        if(maxVal === 0) continue;

        rows.forEach((r) => {
            const td = r.children[col];
            const val = parseFloat(td.dataset.sort ?? td.textContent) || 0;

            const intensity = Math.pow(val / maxVal, 0.5);

            const hue = 120;
            const lightness = 100 - intensity * 60;

            td.style.backgroundColor = `hsl(${hue}, 70%, ${lightness}%)`;
            td.style.color = intensity > 0.6 ? '#fff' : '#000';
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

// ---------------- RESIZE ----------------
export function makeColumnsResizable(table) {
    const headers = table.querySelectorAll('thead th');

    headers.forEach(th => {
        if (th.querySelector('.resize-handle')) return;

        th.classList.add('resizable');

        const handle = document.createElement('div');
        handle.classList.add('resize-handle');

        th.appendChild(handle);

        let startX, startWidth;

        handle.addEventListener('mousedown', e => {
            e.preventDefault();

            startX = e.pageX;
            startWidth = th.offsetWidth;

            const index = Array.from(th.parentElement.children).indexOf(th);

            const onMouseMove = e => {
                const newWidth = startWidth + (e.pageX - startX);

                th.style.width = `${newWidth}px`;

                table.querySelectorAll('tbody tr').forEach(tr => {
                    if (tr.children[index]) {
                        tr.children[index].style.width = `${newWidth}px`;
                    }
                });
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}