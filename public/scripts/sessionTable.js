// scripts/sessionTable.js
import { createCell, applyStickyColumns, formatSecondsToHMS, sortTableByRow } from './utils.js';

export function renderSessionTable(STATE, perUser, tabs, selectedEmployee = null, isType = false) {
    const table = document.getElementById('bigTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const columns = (selectedEmployee && !isType)
        ? [...new Set(STATE.fullSessions.map(s => s.session_id))].sort()
        : STATE.userOrder;

    // -------------------------
    // Header Row
    // -------------------------
    const headerRow = document.createElement('tr');
    ['Operation', 'AVERAGE', 'TOTAL', ...columns].forEach((text, idx) => {
        const th = document.createElement('th');
        th.classList.add('rotate', 'sticky');
        if (idx === 0) th.style.position = 'relative';

        let displayText = text;
        let sessionIdForClick = text;

        if (selectedEmployee && !isType && idx >= 3) {
            const session = STATE.fullSessions.find(s => s.session_id === text);
            if (session) {
                displayText = new Date(session.start_time).toLocaleString();
                sessionIdForClick = session.session_id;
            }
        }

        const div = document.createElement('div');
        div.textContent = displayText;

        if (selectedEmployee && !isType && idx >= 3) {
            div.style.cursor = "pointer";
            div.style.textDecoration = "underline";
            div.addEventListener('click', () => window.loadTimeline(sessionIdForClick));
        }

        th.appendChild(div);
        if (idx >= 3) th.classList.add('user-cell');
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // -------------------------
    // Heatmap calculation
    // -------------------------
    const columnMax = {};
    columns.forEach(col => {
        let maxVal = 0;
        tabs.forEach(tab => {
            let val = 0;
            if (selectedEmployee && !isType) {
                val = STATE.fullSessions.filter(s => s.tab === tab && s.session_id === col)
                    .reduce((a, b) => a + b.durationSeconds, 0);
            } else {
                val = perUser[col]?.filter(s => s.tab === tab).reduce((a, b) => a + b.durationSeconds, 0) || 0;
            }
            if (val > maxVal) maxVal = val;
        });
        columnMax[col] = maxVal;
    });

    function getHeatmapColor(val, maxVal) {
        if (maxVal === 0) return { bg: 'white', color: '#000' };
        const intensity = Math.pow(val / maxVal, 0.5);
        const hue = 120;
        const lightness = 100 - intensity * 60;
        return { bg: `hsl(${hue},70%,${lightness}%)`, color: intensity > 0.6 ? '#fff' : '#000' };
    }

    // -------------------------
    // Table Rows
    // -------------------------
    for (const tab of tabs) {
        const tr = document.createElement('tr');
        tr.dataset.tab = tab;
        tr.classList.add('sortable');

        const opCell = createCell(tab, false, null, 'operation-cell');
        tr.appendChild(opCell);

        // Tooltip above and right of mouse
        opCell.addEventListener('mouseenter', async (e) => {
            const tooltip = document.getElementById('tooltip');
            tooltip.style.display = 'block';
            tooltip.innerHTML = '';

            const configTitle = document.getElementById('eventTypeSelect').value || tab;
            if (window.loadDescriptionTooltip) await window.loadDescriptionTooltip(configTitle);

            const offsetX = 12;
            const offsetY = 12;

            let left = e.pageX + offsetX;
            let top = e.pageY - tooltip.offsetHeight - offsetY;
            if (top < window.scrollY) top = e.pageY + offsetY;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        });

        opCell.addEventListener('mousemove', (e) => {
            const tooltip = document.getElementById('tooltip');
            const offsetX = 12;
            const offsetY = 12;

            let left = e.pageX + offsetX;
            let top = e.pageY - tooltip.offsetHeight - offsetY;
            if (top < window.scrollY) top = e.pageY + offsetY;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        });

        opCell.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('tooltip');
            tooltip.style.display = 'none';
        });

        // Row hover highlight for operation cell only (solid color)
        tr.addEventListener('mouseenter', () => { 
            opCell.style.backgroundColor = '#fcc85d'; // solid highlight
            opCell.style.fontWeight = 'bold'; 
        });
        tr.addEventListener('mouseleave', () => { 
            opCell.style.backgroundColor = ''; // revert to original
            opCell.style.fontWeight = ''; 
        });

        tr.addEventListener('click', () => sortTableByRow(table, tr, STATE.rowSortStates, 3));

        const totalsArray = columns.map(col => {
            if (selectedEmployee && !isType) {
                return STATE.fullSessions.filter(s => s.tab === tab && s.session_id === col)
                    .reduce((a, b) => a + b.durationSeconds, 0);
            } else {
                return perUser[col]?.filter(s => s.tab === tab).reduce((a, b) => a + b.durationSeconds, 0) || 0;
            }
        });

        const total = totalsArray.reduce((a, b) => a + b, 0);
        const avg = totalsArray.length ? total / totalsArray.length : 0;

        tr.appendChild(createCell(formatSecondsToHMS(avg), false, null, 'summary-cell'));
        tr.appendChild(createCell(formatSecondsToHMS(total), false, null, 'summary-cell'));

        totalsArray.forEach((val, i) => {
            const td = createCell(formatSecondsToHMS(val), false, null, 'user-cell');
            td.dataset.sort = val;
            const { bg, color } = getHeatmapColor(val, columnMax[columns[i]]);
            td.style.backgroundColor = bg;
            td.style.color = color;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    }

    // -------------------------
    // Apply sticky first column
    // -------------------------
    applyStickyColumns(table, 3);

    // -------------------------
    // Column & row resizing
    // -------------------------
    makeColumnsResizable(table);
    makeRowsResizable(table);

    function makeColumnsResizable(table) {
        const firstColCells = table.querySelectorAll("thead th:first-child, tbody td:first-child");

        firstColCells.forEach(cell => {
            if (cell.querySelector('.col-resizer')) return;

            const resizer = document.createElement('div');
            resizer.className = 'col-resizer';

            // Position resizer along the right edge of the cell
            resizer.style.position = 'absolute';
            resizer.style.top = 0;
            resizer.style.right = 0;
            resizer.style.width = '6px';       
            resizer.style.height = '100%';
            resizer.style.cursor = 'col-resize';

            cell.style.position = 'relative';  
            cell.appendChild(resizer);

            let startX, startWidth;

            resizer.addEventListener('mousedown', e => {
                e.stopPropagation();
                startX = e.pageX;
                startWidth = cell.offsetWidth;

                function onMouseMove(e) {
                    const newWidth = Math.max(80, startWidth + (e.pageX - startX));

                    // Apply new width to all first-column cells
                    table.querySelectorAll("thead th:first-child, tbody td:first-child")
                        .forEach(td => td.style.width = newWidth + 'px');
                }

                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    function makeRowsResizable(table) {
        const rows = table.querySelectorAll("tbody tr");
        rows.forEach(row => {
            const firstCell = row.querySelector("td");
            if (!firstCell || firstCell.querySelector('.row-resizer')) return;
            firstCell.style.position = "relative";

            const resizer = document.createElement('div');
            resizer.className = 'row-resizer';
            firstCell.appendChild(resizer);

            let startY, startHeight;
            resizer.addEventListener('mousedown', e => {
                e.stopPropagation();
                startY = e.pageY; startHeight = row.offsetHeight;

                function onMouseMove(e) {
                    row.style.height = Math.max(24, startHeight + (e.pageY - startY)) + 'px';
                }

                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }
}