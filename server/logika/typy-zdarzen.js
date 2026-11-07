'use strict';

/**
 * Typy wpisów — 8 operacji na akcjach (CLAUDE-PSA-UPROSZCZENIE.md § 3.1). Różnice w obrębie
 * typu (operacja, rodzaj, podstawa, ułamek) są polami operacji, nie osobnymi typami.
 *
 * Kogo powiadomić i co sprawdzić nie zależy od typu — liczy to `stan.ktoTraci` i
 * `stan.checklista` z porównania stanu i atrybutów akcji. Tu zostaje tylko to, czego nie da się
 * wyczytać ze stanu: czy operacja jest odpłatna (U-02) i czy wpis następuje z urzędu (R3).
 */

const OPERACJE_OBCIAZENIA = ['ustanowienie', 'zmiana_prawa_glosu', 'wykreslenie'];
const RODZAJE_OBCIAZENIA = ['zastaw', 'uzytkowanie', 'zajecie'];
const OPERACJE_ADNOTACJI = ['dodanie', 'wykreslenie'];
const RODZAJE_ADNOTACJI = ['uprawnienie', 'ograniczenie', 'obowiazek', 'niepokryte', 'inna'];
const PODSTAWY_UMORZENIA = ['uchwala', 'orzeczenie'];
const ZRODLA_OTWARCIA = ['zalozenie', 'przejecie'];
const POWODY_ZAMKNIECIA = ['przekazanie', 'wykreslenie_spolki', 'rozwiazanie_umowy'];

/** R3 — z urzędu (art. 300(34) § 2 KSH) ⇔ zajęcie albo jego wykreślenie. Nic poza tym. */
function zUrzedu(op) {
  return Boolean(op) && op.typ === 'obciazenie' && op.rodzaj === 'zajecie';
}

const TYPY = {
  otwarcie: { etykieta: 'Otwarcie rejestru', odplatna: () => false },
  emisja: { etykieta: 'Emisja akcji', odplatna: () => true },
  przeniesienie: { etykieta: 'Przeniesienie akcji', odplatna: () => true },
  umorzenie: { etykieta: 'Umorzenie akcji', odplatna: () => true },
  obciazenie: {
    etykieta: 'Obciążenie akcji',
    odplatna: (op) => op.operacja === 'ustanowienie' && !zUrzedu(op),
  },
  adnotacja: { etykieta: 'Informacja o akcjach', odplatna: () => false },
  sprostowanie: { etykieta: 'Sprostowanie wpisu', odplatna: () => false },
  zamkniecie: { etykieta: 'Zamknięcie rejestru', odplatna: () => false },
};

function istnieje(nazwa) {
  return Object.prototype.hasOwnProperty.call(TYPY, nazwa);
}

/** U-02: czy sprawa zawiera operację, przy której pracownik wybiera opłatę albo jej brak. */
function odplatna(op) {
  return istnieje(op && op.typ) && TYPY[op.typ].odplatna(op);
}

module.exports = {
  TYPY,
  istnieje,
  odplatna,
  zUrzedu,
  OPERACJE_OBCIAZENIA,
  RODZAJE_OBCIAZENIA,
  OPERACJE_ADNOTACJI,
  RODZAJE_ADNOTACJI,
  PODSTAWY_UMORZENIA,
  ZRODLA_OTWARCIA,
  POWODY_ZAMKNIECIA,
};
