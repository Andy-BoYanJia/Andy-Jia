(() => {
  const home = document.querySelector('.home');
  if (!home) return;

  const names = ['learning', 'sport'];
  const labels = new Map(names.map(name => [name, home.querySelector(`.home__label--${name}`)]));
  const scenes = new Map(names.map(name => [name, home.querySelector(`.home__portrait-scene--${name}`)]));
  let hovered = null;
  let current = null;
  let last = null;

  function show(next) {
    if (next === current) return;
    if (!next) {
      // Only leaving both text areas reveals the original split portrait.
      for (const scene of scenes.values()) scene.classList.remove('is-active', 'is-backdrop');
      current = null;
      return;
    }

    const previous = current || last;
    const previousScene = scenes.get(previous);
    const stillVisible = previousScene && parseFloat(getComputedStyle(previousScene).getPropertyValue('--portrait-open')) > 0;

    // Keep the outgoing full portrait behind the next one during the reveal.
    // This prevents either direction from passing through the split portrait.
    for (const [name, scene] of scenes) {
      scene.classList.remove('is-active');
      scene.classList.toggle('is-backdrop', name === previous && name !== next && stillVisible);
    }
    const incoming = scenes.get(next);
    if (previous !== next) {
      incoming.style.transition = 'none';
      incoming.style.setProperty('--portrait-open', '0%');
      void incoming.offsetWidth;
      incoming.style.removeProperty('transition');
    }
    incoming.classList.add('is-active');
    incoming.style.removeProperty('--portrait-open');
    current = next;
    last = next;
  }

  function update() {
    const focused = names.find(name => labels.get(name).matches(':focus-visible'));
    show(hovered || focused || null);
  }

  for (const [name, label] of labels) {
    label.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = name;
      update();
    });
    label.addEventListener('pointerleave', () => {
      if (hovered === name) hovered = null;
      update();
    });
    label.addEventListener('focusin', update);
    label.addEventListener('focusout', () => queueMicrotask(update));
  }
  window.addEventListener('blur', () => { hovered = null; show(null); });
})();
