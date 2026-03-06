// scripts/table.js
import { createCell, sortTableByRow, applyStickyColumns, formatSecondsToHMS } from './utils.js';

export function renderSessionTable({ sessions, perUser, tabs, selectedEmployee, isEmployeeType, state, loadTimeline } = {}) {
    const table = document.getElementById('bigTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (!sessions || sessions.length === 0) return;

    const columns = (selectedEmployee && !isEmployeeType)
        ? [...new Set(sessions.map((s) => s.session_id))].sort()
        : Object.keys(perUser).sort();

    renderTableHeader(thead, columns, sessions, selectedEmployee, isEmployeeType, loadTimeline);
    renderTableRows(tbody, tabs, columns, sessions, perUser, selectedEmployee, isEmployeeType, state);

    applyStickyColumns(table, 3);
    enableColumnResizing(table);
    enableRowResizing(table);
}

function renderTableHeader(thead, columns, sessions, selectedEmployee, isEmployeeType, loadTimeline) {
    const headerRow = document.createElement('tr');

    ['Operation', 'AVERAGE', 'TOTAL', ...columns].forEach((text, index) => {
        const th = document.createElement('th');
        th.classList.add('rotate', 'sticky');
        if (index === 0) th.style.position = 'relative';

        let displayText = text;
        let sessionIdForClick = text;

        if (selectedEmployee && !isEmployeeType && index >= 3) {
            const session = sessions.find((s) => s.session_id === text);
            if (session) {
                displayText = new Date(session.start_time).toLocaleString();
                sessionIdForClick = session.session_id;
            }
        }

        const div = document.createElement('div');
        div.textContent = displayText;

        if (selectedEmployee && !isEmployeeType && index >= 3) {
            div.style.cursor = 'pointer';
            div.style.textDecoration = 'underline';
            div.addEventListener('click', () => loadTimeline(sessionIdForClick));
        }

        th.appendChild(div);
        if (index >= 3) th.classList.add('user-cell');
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
}

function renderTableRows(tbody, tabs, columns, sessions, perUser, selectedEmployee, isEmployeeType, state) {
    const columnMaxValues = {};
    columns.forEach((col) => {
        let maxValue = 0;
        tabs.forEach((tab) => {
            let val = 0;
            if (selectedEmployee && !isEmployeeType) {
                val = sessions.filter((s) => s.tab === tab && s.session_id === col).reduce((a, b) => a + b.durationSeconds, 0);
            } else {
                val = perUser[col]?.filter((s) => s.tab === tab).reduce((a, b) => a + b.durationSeconds, 0) || 0;
            }
            if (val > maxValue) maxValue = val;
        });
        columnMaxValues[col] = maxValue;
    });

    tabs.forEach((tab) => {
        const tr = document.createElement('tr');
        tr.dataset.tab = tab;
        tr.classList.add('sortable');

        const operationCell = createCell(tab, false, null, 'operation-cell');
        tr.appendChild(operationCell);

        operationCell.addEventListener('mouseenter', async () => {
            const tooltip = document.getElementById('tooltip');
            tooltip.style.display = 'block';
            tooltip.innerHTML = `<strong>${tab}</strong>`;
            const rect = operationCell.getBoundingClientRect();
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 6 + window.scrollY}px`;
            tooltip.style.left = `${rect.right - tooltip.offsetWidth + window.scrollX}px`;
        });

        operationCell.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('tooltip');
            tooltip.style.display = 'none';
        });

        const totals = columns.map((col) => {
            if (selectedEmployee && !isEmployeeType) {
                return sessions.filter((s) => s.tab === tab && s.session_id === col).reduce((a, b) => a + b.durationSeconds, 0);
            } else {
                return perUser[col]?.filter((s) => s.tab === tab).reduce((a, b) => a + b.durationSeconds, 0) || 0;
            }
        });

        const totalSum = totals.reduce((a, b) => a + b, 0);
        const average = totals.length ? totalSum / totals.length : 0;

        tr.appendChild(createCell(formatSecondsToHMS(average), false, null, 'summary-cell'));
        tr.appendChild(createCell(formatSecondsToHMS(totalSum), false, null, 'summary-cell'));

        totals.forEach((value, i) => {
            const td = createCell(formatSecondsToHMS(value), false, null, 'user-cell');
            td.dataset.sort = value;

            const { backgroundColor, textColor } = calculateHeatmapColor(value, columnMaxValues[columns[i]]);
            td.style.backgroundColor = backgroundColor;
            td.style.color = textColor;

            tr.appendChild(td);
        });

        tr.addEventListener('mouseenter', () => {
            operationCell.style.backgroundColor = 'rgba(252,199,93,0.5)';
            operationCell.style.fontWeight = 'bold';
        });

        tr.addEventListener('mouseleave', () => {
            operationCell.style.backgroundColor = '';
            operationCell.style.fontWeight = '';
        });

        tr.addEventListener('click', () => sortTableByRow(document.getElementById('bigTable'), tr, state.rowSortStates, 3));

        tbody.appendChild(tr);
    });
}

function calculateHeatmapColor(value, maxValue) {
    if (maxValue === 0) return { backgroundColor: 'white', textColor: '#000' };
    const intensity = Math.pow(value / maxValue, 0.5);
    const hue = 120;
    const lightness = 100 - intensity * 60;
    return { backgroundColor: `hsl(${hue},70%,${lightness}%)`, textColor: intensity > 0.6 ? '#fff' : '#000' };
}

function enableColumnResizing(table) {
    const headers = table.querySelectorAll('thead th');
    headers.forEach((th, colIndex) => {
        if (th.querySelector('.col-resizer')) return;
        const resizer = document.createElement('div');
        resizer.className = 'col-resizer';
        th.appendChild(resizer);

        resizer.addEventListener('mousedown', (event) => {
            event.stopPropagation();
            let startX = event.pageX;
            let startWidth = th.offsetWidth;

            function onMouseMove(e) {
                const newWidth = Math.max(40, startWidth + (e.pageX - startX));
                th.style.width = newWidth + 'px';
                table.querySelectorAll(`tr td:nth-child(${colIndex + 1})`).forEach(td => td.style.width = newWidth + 'px');
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

function enableRowResizing(table) {
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row) => {
        const firstCell = row.querySelector('td');
        if (!firstCell || firstCell.querySelector('.row-resizer')) return;

        firstCell.style.position = 'relative';
        const resizer = document.createElement('div');
        resizer.className = 'row-resizer';
        firstCell.appendChild(resizer);

        resizer.addEventListener('mousedown', (event) => {
            event.stopPropagation();
            let startY = event.pageY;
            let startHeight = row.offsetHeight;

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