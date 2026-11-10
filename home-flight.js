(() => {
  const assembly = document.querySelector('.flight-assembly');
  if (!assembly) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function finishArrival() {
    delete assembly.dataset.arrival;
  }

  function startArrival() {
    if (assembly.dataset.arrival !== 'pending') return;
    if (reducedMotion.matches) finishArrival();
    else assembly.dataset.arrival = 'flying';
  }

  assembly.addEventListener('animationend', event => {
    if (event.target === assembly && event.animationName === 'flight-arrival') finishArrival();
  });
  const image = assembly.querySelector('.flight-disc__image');
  if (image?.decode) image.decode().then(startArrival, finishArrival);
  else startArrival();

  const scene = assembly.querySelector('.flight-scene');
  const disc = assembly.querySelector('.flight-disc');
  if (!scene || !disc) return;

  let drag = null;

  disc.addEventListener('pointerdown', event => {
    if (drag || scene.hasAttribute('data-launching') ||
        assembly.hasAttribute('data-arrival') || event.button !== 0) return;

    // Pick up from the current position, even while the disc is returning.
    const position = new DOMMatrixReadOnly(getComputedStyle(disc).transform);
    disc.setPointerCapture(event.pointerId);
    drag = {
      pointerId: event.pointerId,
      originX: event.clientX - position.m41,
      originY: event.clientY - position.m42,
    };
    scene.dataset.dragging = '';
    disc.style.transform = `translate(${position.m41}px, ${position.m42}px)`;
  });

  disc.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.pointerId) return;
    disc.style.transform = `translate(${event.clientX - drag.originX}px, ${event.clientY - drag.originY}px)`;
  });

  function finishDrag(event) {
    if (event.pointerId !== drag?.pointerId) return;
    drag = null;
    delete scene.dataset.dragging;
    disc.style.removeProperty('transform');
  }

  disc.addEventListener('pointerup', finishDrag);
  disc.addEventListener('pointercancel', finishDrag);
  disc.addEventListener('lostpointercapture', finishDrag);

  const stage = assembly.closest('.flight-stage');
  const wind = scene.querySelector('.wind');
  const shadow = scene.querySelector('.disc-shadow');
  const words = scene.querySelector('.wind-words');
  if (!stage || !wind || !shadow || !words) return;

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  function offscreen(elements, angle, wordSpace) {
    const frame = stage.getBoundingClientRect();
    const bounds = elements.map(element => element.getBoundingClientRect());
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    // Clear the entire group, including the wind's blur and the words' spin.
    const margin = wordSpace
      ? Math.max(...elements.map(element => Math.hypot(element.offsetWidth, element.offsetHeight))) + 30
      : 80;
    const distanceX = Math.abs(x) < 0.001 ? Infinity : x > 0
      ? (frame.right + margin - Math.min(...bounds.map(rect => rect.left))) / x
      : (frame.left - margin - Math.max(...bounds.map(rect => rect.right))) / x;
    const distanceY = Math.abs(y) < 0.001 ? Infinity : y > 0
      ? (frame.bottom + margin - Math.min(...bounds.map(rect => rect.top))) / y
      : (frame.top - margin - Math.max(...bounds.map(rect => rect.bottom))) / y;
    const distance = Math.max(0, Math.min(distanceX, distanceY));
    const offset = new DOMPoint(x * distance, y * distance, 0, 0);
    // The text sits inside a rotated container. Convert screen travel to its local axes.
    const point = wordSpace ? wordSpace.transformPoint(offset) : offset;
    return `${point.x}px ${point.y}px`;
  }

  disc.addEventListener('dblclick', async () => {
    if (drag || scene.hasAttribute('data-launching') || reducedMotion.matches) return;
    scene.dataset.launching = '';

    const animations = [];
    function play(element, keyframes, timing) {
      const animation = element.animate(keyframes, { fill: 'both', ...timing });
      animations.push(animation);
      return animation;
    }

    try {
      const launchAngle = -0.42;
      const recoil = `${-Math.cos(launchAngle) * 14}px ${-Math.sin(launchAngle) * 14}px`;
      const wordSpace = new DOMMatrixReadOnly(getComputedStyle(words).transform).inverse();
      const groups = [
        { elements: [disc, wind], angle: launchAngle, duration: 650, delay: 0 },
        ...Array.from(words.children, (word, index) => ({
          elements: [word],
          angle: launchAngle + Math.PI + (index === 0 ? -0.52 : 0.42) + randomBetween(-0.12, 0.12),
          duration: index === 0 ? 690 : 810,
          delay: index === 0 ? 100 : 150,
          spin: (index === 0 ? -1 : 1) * randomBetween(170, 310),
        })),
      ].map(group => ({
        ...group,
        exit: offscreen(group.elements, group.angle, group.spin ? wordSpace : null),
        entry: offscreen(group.elements, group.angle + randomBetween(2.25, 4.05),
          group.spin ? wordSpace : null),
      }));

      for (const { elements, exit, duration, delay, spin } of groups) {
        for (const element of elements) {
          const frames = spin
            ? [{ translate: '0px 0px', rotate: '0deg' }, { translate: exit, rotate: `${spin}deg` }]
            : [
                { translate: '0px 0px', easing: 'ease-out' },
                { translate: recoil, offset: 0.14, easing: 'cubic-bezier(.55, .02, .86, .52)' },
                { translate: exit },
              ];
          play(element, frames, { duration, delay, easing: spin ? 'cubic-bezier(.16,.55,.38,1)' : 'linear' });
        }
      }
      play(shadow, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 320, delay: 90 });

      const departing = animations.slice();
      await Promise.all(departing.map(animation => animation.finished));
      await new Promise(resolve => setTimeout(resolve, 420));

      for (const { elements, entry, spin, delay } of groups) {
        for (const element of elements) {
          const frames = spin
            ? [{ translate: entry, rotate: `${randomBetween(-300, 300)}deg` },
                { translate: '0px 0px', rotate: '0deg' }]
            : [{ translate: entry }, { translate: '0px 0px' }];
          play(element, frames, { duration: spin ? 930 : 1060, delay, easing: 'cubic-bezier(.18,.72,.25,1)' });
        }
      }
      play(shadow, [{ opacity: 0 }, { opacity: 0.5 }], { duration: 520, delay: 300 });
      for (const animation of departing) animation.cancel();
      await Promise.all(animations.slice(departing.length).map(animation => animation.finished));
    } finally {
      for (const animation of animations) animation.cancel();
      delete scene.dataset.launching;
    }
  });
})();
