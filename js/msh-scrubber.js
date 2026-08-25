/* My Simple Health — continuous Journey scrubber math */
(function (root) {
  'use strict';
  const MAX = 1000;
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Number(value) || 0)); }
  function positionForIndex(index, count) { return count <= 1 ? 0 : Math.round(clamp(index, 0, count - 1) / (count - 1) * MAX); }
  function indexForPosition(position, count) { return count <= 1 ? 0 : Math.round(clamp(position, 0, MAX) / MAX * (count - 1)); }
  function positionFromClientX(clientX, left, width) {
    if (!Number.isFinite(width) || width <= 0) return 0;
    return Math.round(clamp((Number(clientX) - Number(left)) / width, 0, 1) * MAX);
  }
  function keyboardIndex(key, currentIndex, count) {
    const last = Math.max(0, count - 1);
    if (key === 'Home') return 0;
    if (key === 'End') return last;
    if (key === 'ArrowLeft' || key === 'ArrowDown') return clamp(currentIndex - 1, 0, last);
    if (key === 'ArrowRight' || key === 'ArrowUp') return clamp(currentIndex + 1, 0, last);
    if (key === 'PageDown') return clamp(currentIndex - 5, 0, last);
    if (key === 'PageUp') return clamp(currentIndex + 5, 0, last);
    return null;
  }
  root.MSHScrubber = Object.freeze({ MAX, positionForIndex, indexForPosition, positionFromClientX, keyboardIndex });
})(typeof window !== 'undefined' ? window : globalThis);
