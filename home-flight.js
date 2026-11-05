(() => {
  const home = document.querySelector('.flight-home');
  const assembly = document.querySelector('.flight-assembly');
  const disc = document.querySelector('.flight-disc');
  const reset = document.querySelector('.flight-reset');
  const status = document.querySelector('#flight-status');
  if (!home || !assembly || !disc) return;

  let position = null;
  let drag = null;
  let frame = 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function finishArrival() {
    delete assembly.dataset.arrival;
  }

  function startArrival() {
    if (assembly.dataset.arrival !== 'pending') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishArrival();
    else assembly.dataset.arrival = 'flying';
  }

  assembly.addEventListener('animationend', event => {
    if (event.target === assembly && event.animationName === 'flight-arrival') finishArrival();
  });
  const image = disc.querySelector('img');
  if (image?.decode) image.decode().then(startArrival, finishArrival);
  else startArrival();

  function bounds() {
    // Reserve space for the gentle bob, keeping the full disc inside the homepage.
    const size = assembly.getBoundingClientRect();
    const margin = 24;
    return {
      minX: size.width / 2 + 12,
      maxX: Math.max(size.width / 2 + 12, home.clientWidth - size.width / 2 - 12),
      minY: size.height / 2 + margin,
      maxY: Math.max(size.height / 2 + margin, home.clientHeight - size.height / 2 - margin)
    };
  }

  function paint() {
    frame = 0;
    if (!position) return;
    const limit = bounds();
    position.x = clamp(position.x, limit.minX, limit.maxX);
    position.y = clamp(position.y, limit.minY, limit.maxY);
    assembly.style.left = `${position.x}px`;
    assembly.style.top = `${position.y}px`;
  }

  function move(x, y) {
    position = { x, y };
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function finish(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const pointerId = drag.id;
    drag = null;
    home.classList.remove('is-dragging');
    if (disc.hasPointerCapture(pointerId)) disc.releasePointerCapture(pointerId);
  }

  function returnHome() {
    finishArrival();
    if (drag) finish({ pointerId: drag.id });
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    position = null;
    assembly.style.removeProperty('left');
    assembly.style.removeProperty('top');
    status.textContent = 'The disc is back at its starting position.';
  }

  disc.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    finishArrival();
    const rect = assembly.getBoundingClientRect();
    const container = home.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2 - container.left, y: rect.top + rect.height / 2 - container.top };
    drag = { id: event.pointerId, offsetX: event.clientX - container.left - center.x, offsetY: event.clientY - container.top - center.y };
    position = center;
    disc.setPointerCapture(event.pointerId);
    home.classList.add('is-dragging');
    disc.focus({ preventScroll: true });
    event.preventDefault();
  });

  disc.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const container = home.getBoundingClientRect();
    move(event.clientX - container.left - drag.offsetX, event.clientY - container.top - drag.offsetY);
  });

  disc.addEventListener('pointerup', finish);
  disc.addEventListener('pointercancel', finish);
  disc.addEventListener('lostpointercapture', finish);
  window.addEventListener('blur', () => { if (drag) finish({ pointerId: drag.id }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && drag) finish({ pointerId: drag.id }); });

  disc.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'Home') {
      event.preventDefault();
      returnHome();
      return;
    }
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!steps[event.key]) return;
    event.preventDefault();
    finishArrival();
    const rect = assembly.getBoundingClientRect();
    const container = home.getBoundingClientRect();
    const current = position || { x: rect.left + rect.width / 2 - container.left, y: rect.top + rect.height / 2 - container.top };
    const step = event.shiftKey ? 60 : 24;
    move(current.x + steps[event.key][0] * step, current.y + steps[event.key][1] * step);
  });

  reset.addEventListener('click', returnHome);
  window.addEventListener('resize', () => {
    if (drag) finish({ pointerId: drag.id });
    if (position) paint();
  });
})();
