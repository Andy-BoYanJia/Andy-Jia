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

  function fractureWord(word) {
    const label = word.querySelector('.wind-word__label');
    const whole = label.querySelector('.wind-word__whole');
    const columns = Math.ceil(whole.textContent.length / 1.5);
    // Neighboring pieces share the same vertices so the letters fit back together.
    const grid = [0, 50, 100].map((y, row) =>
      Array.from({ length: columns + 1 }, (_, column) => [
        column * 100 / columns + (column > 0 && column < columns ? randomBetween(-6, 6) : 0),
        y + (row === 1 ? randomBetween(-13, 13) : 0),
      ])
    );
    const shards = [];
    const fragment = document.createDocumentFragment();
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < columns; column++) {
        const a = grid[row][column];
        const b = grid[row][column + 1];
        const c = grid[row + 1][column];
        const d = grid[row + 1][column + 1];
        for (const triangle of [[a, b, c], [b, d, c]]) {
          const element = document.createElement('span');
          element.className = 'wind-word__shard';
          element.setAttribute('aria-hidden', 'true');
          element.textContent = whole.textContent;
          element.style.clipPath = `polygon(${triangle.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
          const x = (column / (columns - 1) - .5) * 220 + randomBetween(-32, 32);
          const y = (row === 0 ? -1 : 1) * randomBetween(54, 135);
          const spin = randomBetween(-85, 85);
          const pose = (distance, scale) =>
            `translate(${x * distance}px, ${y * distance}px) rotate(${spin * distance}deg) scale(${scale})`;
          shards.push({ element, burst: pose(.75, 1), scatter: pose(1, randomBetween(.7, .95)) });
          fragment.append(element);
        }
      }
    }
    label.append(fragment);
    return { whole, shards };
  }

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
    const fractures = new Map();
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
          if (spin) {
            const fracture = fractureWord(element);
            fractures.set(element, fracture);
            play(element, [
              { scale: '1' },
              { scale: '.96 1.04', offset: .055 },
              { scale: '1.045 .98', offset: .10 },
              { scale: '1', offset: .22 },
              { scale: '1' },
            ], { duration, delay });
            play(fracture.whole, [
              { opacity: 1, easing: 'steps(1, end)' },
              { opacity: 0, offset: .10 },
              { opacity: 0 },
            ], { duration, delay });
            for (const shard of fracture.shards) {
              play(shard.element, [
                { opacity: 0, transform: 'none', easing: 'steps(1, end)' },
                { opacity: 1, transform: 'none', offset: .10, easing: 'cubic-bezier(.12,.78,.25,1)' },
                { opacity: 1, transform: shard.burst, offset: .35, easing: 'ease-out' },
                { opacity: 1, transform: shard.scatter },
              ], { duration, delay });
            }
          }
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
          const fracture = fractures.get(element);
          if (fracture) {
            play(fracture.whole, [{ opacity: 0 }, { opacity: 0, offset: .78 }, { opacity: 1 }], { duration: 930, delay });
            for (const shard of fracture.shards) {
              play(shard.element, [
                { opacity: 1, transform: shard.scatter, easing: 'cubic-bezier(.22,.68,.35,1)' },
                { opacity: 1, transform: 'none', offset: .78 },
                { opacity: 0, transform: 'none' },
              ], { duration: 930, delay });
            }
          }
        }
      }
      play(shadow, [{ opacity: 0 }, { opacity: 0.5 }], { duration: 520, delay: 300 });
      for (const animation of departing) animation.cancel();
      await Promise.all(animations.slice(departing.length).map(animation => animation.finished));
    } finally {
      for (const animation of animations) animation.cancel();
      for (const { shards } of fractures.values()) {
        for (const { element } of shards) element.remove();
      }
      delete scene.dataset.launching;
    }
  });
})();
