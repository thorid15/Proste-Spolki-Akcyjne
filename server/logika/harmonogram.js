'use strict';

/**
 * Jeden proces dzienny (`server/proces-dzienny.js`): od razu po starcie (nadrabia przerwę) i potem
 * raz na dobę. Bez nowej zależności — `setInterval` wystarcza dla jednego procesu serwera kancelarii.
 */
function uruchomProcesDzienny(db, { interwalMs = 24 * 60 * 60 * 1000, proces = (b) => require('../proces-dzienny').procesDzienny(b) } = {}) {
  const uruchom = () => {
    Promise.resolve()
      .then(() => proces(db))
      .catch((e) => console.error(`[psa] proces dzienny: ${e.message}`));
  };
  uruchom();
  const uchwyt = setInterval(uruchom, interwalMs);
  uchwyt.unref?.();
  return uchwyt;
}

module.exports = { uruchomProcesDzienny };
