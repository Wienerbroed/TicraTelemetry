// tableRenderer.js
import { createCell, sortTableByRow, applyStickyColumns, downloadTableCSV, fetchJson } from './utils.js';

export function toggleDownloadButton(show){
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.style.display = show ? 'block' : 'none';
}

export async function drawTable(perUser, STATE) {
  const selections = [...new Set(Object.keys(perUser).flatMap(u=>Object.keys(perUser[u])))].sort();
  const table = document.getElementById('bigTable');
  const thead = table.querySelector('thead'); 
  const tbody = table.querySelector('tbody');
  const tooltip = document.getElementById('tooltip');
  
  thead.innerHTML = ''; 
  tbody.innerHTML = '';

  const headerRow = document.createElement('tr');
  ['Operation', 'MOST USED', 'AVERAGE', 'TOTAL', ...STATE.userOrder].forEach((text, index) => {
    const th = document.createElement('th'); 
    th.classList.add('rotate', 'sticky');
    if (index === 0) th.style.position = 'relative';
    const div = document.createElement('div'); 
    div.textContent = text;
    th.appendChild(div); 
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  function makeColumnsResizable(table) {
    const headers = table.querySelectorAll("thead th");
    headers.forEach((th, colIndex) => {
      if (th.querySelector('.col-resizer')) return;
      const resizer = document.createElement("div");
      resizer.classList.add("col-resizer");
      th.appendChild(resizer);
      let startX, startWidth;
      resizer.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        startX = e.pageX;
        startWidth = th.offsetWidth;
        function onMouseMove(e) {
          const newWidth = Math.max(40, startWidth + (e.pageX - startX));
          th.style.width = newWidth + "px";
          table.querySelectorAll(`tr td:nth-child(${colIndex + 1})`)
            .forEach(td => td.style.width = newWidth + "px");
        }
        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        }
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  }

  function makeRowsResizable(table) {
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach(row => {
      const firstCell = row.querySelector("td");
      if (!firstCell || firstCell.querySelector('.row-resizer')) return;
      firstCell.style.position = "relative";
      const resizer = document.createElement("div");
      resizer.classList.add("row-resizer");
      firstCell.appendChild(resizer);
      let startY, startHeight;
      resizer.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        startY = e.pageY;
        startHeight = row.offsetHeight;
        function onMouseMove(e) {
          const newHeight = Math.max(24, startHeight + (e.pageY - startY));
          row.style.height = newHeight + "px";
        }
        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        }
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  }

  let rowColorToggle = false;

  for (const eventType of STATE.eventTypeOrder) {
    const eventSelections = selections.filter(s => s.startsWith(eventType + '::'));
    const config = await fetchJson(`/api/configs/${encodeURIComponent(eventType)}`).catch(() => null);
    const description = config?.description ?? '';
    const imgSrc = config?.extra_query?.image?.data
      ? `data:${config.extra_query.image.contentType};base64,${config.extra_query.image.data}`
      : null;

    const columnMax = {}; 
    STATE.userOrder.forEach(u => {
      let maxVal = 0; 
      eventSelections.forEach(sel => { 
        const val = perUser[u]?.[sel] ?? 0; 
        if (val > maxVal) maxVal = val; 
      }); 
      columnMax[u] = maxVal;
    });

    for (const sel of eventSelections) {
      const tr = document.createElement('tr'); 
      tr.classList.add('sortable');
      tr.classList.add(rowColorToggle ? 'eventtype-grey' : 'eventtype-white');

      const displayName = sel.split('::')[1];
      const opCell = createCell(displayName, false, null, 'operation-cell');
      tr.appendChild(opCell);

      opCell.addEventListener('mouseenter', (e) => {
        tooltip.innerHTML = ''; 
        tooltip.style.display = 'block';
        if (eventType) {
          const titleP = document.createElement('p');
          titleP.textContent = eventType;
          titleP.style.fontWeight = 'bold';
          tooltip.appendChild(titleP);
        }
        if (description) { 
          const p = document.createElement('p'); 
          p.textContent = description; 
          tooltip.appendChild(p); 
        }
        if (imgSrc) { 
          const img = document.createElement('img'); 
          img.src = imgSrc; 
          tooltip.appendChild(img); 
        }
        const selP = document.createElement('p'); 
        selP.textContent = displayName; 
        tooltip.appendChild(selP);
        const offsetY = 10; 
        tooltip.style.top = `${e.pageY - tooltip.offsetHeight - offsetY}px`;
        tooltip.style.left = `${e.pageX - tooltip.offsetWidth / 10}px`;
      });

      opCell.addEventListener('mousemove', (e) => {
        const offsetY = 10;
        tooltip.style.top = `${e.pageY - tooltip.offsetHeight - offsetY}px`;
        tooltip.style.left = `${e.pageX - tooltip.offsetWidth / 100}px`;
      });

      opCell.addEventListener('mouseleave', () => { 
        tooltip.style.display = 'none'; 
      });

      const total = STATE.userOrder.reduce((sum, u) => sum + (perUser[u]?.[sel] ?? 0), 0);
      const avg = STATE.userOrder.length ? (total / STATE.userOrder.length).toFixed(2) : 0;
      let mostUsed = 0; 
      STATE.userOrder.forEach(u => {
        if ((perUser[u]?.[sel] ?? 0) === columnMax[u] && columnMax[u] > 0) mostUsed++;
      });

      tr.appendChild(createCell(mostUsed, false, null, 'summary-cell'));
      tr.appendChild(createCell(avg, false, null, 'summary-cell'));
      tr.appendChild(createCell(total, false, null, 'summary-cell'));

      STATE.userOrder.forEach(u => {
        const val = perUser[u]?.[sel] ?? 0;
        const intensity = columnMax[u] ? Math.pow(val / columnMax[u], 0.5) : 0;
        const hue = 120, lightness = 100 - intensity * 60;
        const color = intensity > 0.6 ? '#fff' : '#000';
        const td = createCell(val, false, null, 'user-cell');
        td.style.backgroundColor = `hsl(${hue},70%,${lightness}%)`; 
        td.style.color = color;
        tr.appendChild(td);
      });

      tr.addEventListener('mouseenter', () => { 
        opCell.style.backgroundColor = 'rgba(252,199,93,0.5)'; 
        opCell.style.fontWeight = 'bold'; 
      });
      tr.addEventListener('mouseleave', () => { 
        opCell.style.backgroundColor = ''; 
        opCell.style.fontWeight = ''; 
      });

      tr.addEventListener('click', () => sortTableByRow(table, tr, STATE.rowSortStates, 4));

      tbody.appendChild(tr);
    }

    rowColorToggle = !rowColorToggle;
  }

  applyStickyColumns(table, 4);
  toggleDownloadButton(tbody.children.length > 0);
  makeColumnsResizable(table);
  makeRowsResizable(table);
}


