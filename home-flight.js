(() => {
  const assembly = document.querySelector('.flight-assembly');
  if (!assembly) return;

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
  const image = assembly.querySelector('.flight-disc__image');
  if (image?.decode) image.decode().then(startArrival, finishArrival);
  else startArrival();
})();
