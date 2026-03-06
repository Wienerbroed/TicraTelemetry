// dateHelpers.js
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