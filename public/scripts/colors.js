// colors.js
export const COLORS = ['#4caf50','#2196f3','#ff9800','#f44336','#9c27b0','#00bcd4','#ffeb3b','#795548'];

// Map to store assigned colors by data type
export const colorMap = {};
let colorIndex = 0;

/**
 * Returns a consistent color for a given type.
 * If the type hasn't been assigned a color yet, assign the next available color.
 */
export function getColorForType(type) {
    if (!colorMap[type]) {
        colorMap[type] = COLORS[colorIndex % COLORS.length];
        colorIndex++;
    }
    return colorMap[type];
}

/** Reset color mapping (optional if you reload all charts) */
export function resetColorMap() {
    Object.keys(colorMap).forEach(key => delete colorMap[key]);
    colorIndex = 0;
}