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
  let flight = null;
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

  function paint(followPointer = Boolean(drag)) {
    frame = 0;
    if (!position) return;
    const limit = followPointer
      ? { minX: 0, maxX: home.clientWidth, minY: 0, maxY: home.clientHeight }
      : bounds();
    position.x = clamp(position.x, limit.minX, limit.maxX);
    position.y = clamp(position.y, limit.minY, limit.maxY);
    assembly.style.left = `${position.x}px`;
    assembly.style.top = `${position.y}px`;
  }

  function move(x, y) {
    position = { x, y };
    if (!frame) frame = requestAnimationFrame(() => paint());
  }

  function stopThrow() {
    flight?.cancel();
    flight = null;
    delete assembly.dataset.throwing;
  }

  function throwDisc(dx, dy, speed) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (frame) cancelAnimationFrame(frame);
    paint(true);
    const release = position;
    position = null;
    assembly.style.removeProperty('left');
    assembly.style.removeProperty('top');

    const stage = home.getBoundingClientRect();
    const rect = assembly.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2 - stage.left, y: rect.top + rect.height / 2 - stage.top };
    const parts = [rect, ...Array.from(assembly.querySelectorAll('.wind, .wind-word, .disc-shadow'), part => part.getBoundingClientRect())];
    const edges = {
      left: Math.min(...parts.map(part => part.left)) - stage.left - 40,
      right: Math.max(...parts.map(part => part.right)) - stage.left + 40,
      top: Math.min(...parts.map(part => part.top)) - stage.top - 40,
      bottom: Math.max(...parts.map(part => part.bottom)) - stage.top + 40,
    };

    function outside(startX, startY, directionX, directionY) {
      const horizontal = directionX > 0 ? stage.width - edges.left : edges.right;
      const vertical = directionY > 0 ? stage.height - edges.top : edges.bottom;
      const distanceX = directionX ? Math.max(0, horizontal - Math.sign(directionX) * startX) / Math.abs(directionX) : Infinity;
      const distanceY = directionY ? Math.max(0, vertical - Math.sign(directionY) * startY) / Math.abs(directionY) : Infinity;
      const distance = Math.min(distanceX, distanceY);
      return { x: startX + directionX * distance, y: startY + directionY * distance };
    }

    const start = { x: release.x - origin.x, y: release.y - origin.y };
    const exit = outside(start.x, start.y, dx, dy);
    const entry = outside(0, 0, -dx, -dy);
    const exitDistance = Math.max(1, Math.hypot(exit.x - start.x, exit.y - start.y));
    const entryDistance = Math.max(1, Math.hypot(entry.x, entry.y));
    const exitTime = clamp(exitDistance / clamp(speed, .65, 2.3), 450, 1100);
    const edgeSpeed = exitDistance / exitTime;
    const entryTime = clamp(entryDistance / edgeSpeed * 1.65, 530, 1050);
    const duration = exitTime + 16 + entryTime;
    // Match the release velocity at takeoff, then ease to a stop on return.
    const exitSlope = clamp(speed / edgeSpeed, .12, 2.6);
    const entrySlope = clamp(edgeSpeed * entryTime / entryDistance, 1, 2.9);
    const transform = ({ x, y }) => `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    assembly.dataset.throwing = '';
    flight = assembly.animate([
      { transform: transform(start), offset: 0, easing: `cubic-bezier(.24,${.24 * exitSlope},.72,.72)` },
      { transform: transform(exit), offset: exitTime / duration, easing: 'steps(1, end)' },
      { transform: transform(entry), offset: (exitTime + 16) / duration, easing: `cubic-bezier(.28,${.28 * entrySlope},.6,1)` },
      { transform: transform({ x: 0, y: 0 }), offset: 1 },
    ], { duration });
    flight.onfinish = stopThrow;
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
    stopThrow();
    if (drag) finish({ pointerId: drag.id });
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    position = null;
    assembly.style.removeProperty('left');
    assembly.style.removeProperty('top');
    status.textContent = 'The disc is back at its starting position.';
  }

  disc.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || flight) return;
    finishArrival();
    const rect = assembly.getBoundingClientRect();
    const container = home.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2 - container.left, y: rect.top + rect.height / 2 - container.top };
    drag = {
      id: event.pointerId,
      offsetX: event.clientX - container.left - center.x,
      offsetY: event.clientY - container.top - center.y,
      samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }],
    };
    position = center;
    disc.setPointerCapture(event.pointerId);
    home.classList.add('is-dragging');
    disc.blur();
    event.preventDefault();
  });

  disc.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.samples = drag.samples.filter(sample => event.timeStamp - sample.time <= 180);
    drag.samples.push({ x: event.clientX, y: event.clientY, time: event.timeStamp });
    const container = home.getBoundingClientRect();
    move(event.clientX - container.left - drag.offsetX, event.clientY - container.top - drag.offsetY);
  });

  disc.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const last = drag.samples.at(-1);
    const first = drag.samples.find(sample => event.timeStamp - sample.time <= 180);
    if (frame) {
      cancelAnimationFrame(frame);
      paint(true);
    }
    finish(event);
    if (!first || event.timeStamp - last.time > 90) return;
    const dx = event.clientX - first.x;
    const dy = event.clientY - first.y;
    const distance = Math.hypot(dx, dy);
    const speed = distance / Math.max(1, event.timeStamp - first.time);
    if (distance >= 16 && speed >= .32) throwDisc(dx / distance, dy / distance, speed);
  });
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
    stopThrow();
    const rect = assembly.getBoundingClientRect();
    const container = home.getBoundingClientRect();
    const current = position || { x: rect.left + rect.width / 2 - container.left, y: rect.top + rect.height / 2 - container.top };
    const step = event.shiftKey ? 60 : 24;
    move(current.x + steps[event.key][0] * step, current.y + steps[event.key][1] * step);
  });

  reset.addEventListener('click', returnHome);
  window.addEventListener('resize', () => {
    if (drag) finish({ pointerId: drag.id });
    stopThrow();
    if (position) paint();
  });
})();
