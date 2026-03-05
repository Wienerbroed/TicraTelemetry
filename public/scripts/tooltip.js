export function setupTooltip(tooltip) {
  document.addEventListener('mousemove', e => {
    if (tooltip.style.display === 'block') {
      tooltip.style.top = `${e.pageY - tooltip.offsetHeight - 10}px`;
      tooltip.style.left = `${e.pageX - tooltip.offsetWidth/100}px`;
    }
  });
}