'use strict';

/** Sprawa — tabela przejść stanów (§ 3.3) i kroki ekranu sprawy. Moduł czysty. */

const { BladWalidacji } = require('./walidacje');

const OPISY_STANOW = {
  w_toku: 'w toku',
  wstrzymana: 'wstrzymana',
  wpisana: 'wpisana',
  odmowa: 'odmowa',
  wycofana: 'wycofana',
};

/** Każda sprawa zaczyna od `w_toku`; `wpisana`, `odmowa`, `wycofana` są końcowe. */
const PRZEJSCIA = {
  w_toku: ['wstrzymana', 'wpisana', 'odmowa', 'wycofana'],
  wstrzymana: ['w_toku', 'odmowa', 'wycofana'],
  wpisana: [],
  odmowa: [],
  wycofana: [],
};

function sprawdzPrzejscie(z, na) {
  if (!(PRZEJSCIA[z] || []).includes(na)) {
    throw new BladWalidacji([`Sprawa w stanie „${OPISY_STANOW[z] || z}” nie może przejść do stanu „${OPISY_STANOW[na] || na}”.`]);
  }
}

/** Krok ekranu sprawy: 1 — treść, 2 — sprawdzenie (po „Dalej”), 3 — pisma (po wpisie). */
function krok(sprawa) {
  if (sprawa.stan === 'wpisana') return 3;
  return sprawa.tresc_zatwierdzona ? 2 : 1;
}

/** Sprawa w toku albo wstrzymana — wolno zmieniać jej dane robocze. */
function otwarta(sprawa) {
  return sprawa.stan === 'w_toku' || sprawa.stan === 'wstrzymana';
}

module.exports = { OPISY_STANOW, PRZEJSCIA, sprawdzPrzejscie, krok, otwarta };
