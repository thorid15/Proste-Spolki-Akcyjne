'use strict';

/**
 * D-Z — osoba dzialajaca przy wpisie: notariusz albo zastepca notarialny
 * (imie, nazwisko, funkcja), niezaleznie od pracownika-autora. Wylacznie do
 * audytu - nie trafia na zaden dokument ani do portalu.
 *
 * Kolejnosc ustalania: wskazana w zadaniu (`dzialajacy_id`) → domyslna
 * pracownika (`psa_uzytkownicy.osoba_dzialajaca_id`) → jedyny aktywny
 * notariusz w slowniku → notariusz z konfiguracji, gdy slownik jest pusty.
 * Gdy nie da sie ustalic jednoznacznie - odmowa, a nie domysl.
 */

const konfiguracja = require('../konfiguracja');

const FUNKCJE = { notariusz: 'notariusz', zastepca_notarialny: 'zastępca notarialny' };

class BladOsobyDzialajacej extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladOsobyDzialajacej';
    this.status = 400;
  }
}

function zWiersza(w) {
  return { id: w.id, imie: w.imie, nazwisko: w.nazwisko, funkcja: w.funkcja };
}

function aktywna(db, id) {
  if (id == null || id === '') return null;
  return db.prepare('SELECT * FROM psa_osoby_dzialajace WHERE id = ? AND aktywny = 1').get(Number(id)) || null;
}

function zKonfiguracji() {
  const pelne = String(konfiguracja.KANCELARIA.notariusz_mianownik || '').trim();
  const czesci = pelne.split(/\s+/);
  if (czesci.length < 2) return null;
  return { id: null, imie: czesci.slice(0, -1).join(' '), nazwisko: czesci[czesci.length - 1], funkcja: 'notariusz' };
}

/**
 * @param {object} db
 * @param {object} opcje `{ wskazanaId, uzytkownik }`
 * @returns {{ id, imie, nazwisko, funkcja }}
 */
function ustal(db, { wskazanaId, uzytkownik } = {}) {
  if (wskazanaId != null && wskazanaId !== '') {
    const w = aktywna(db, wskazanaId);
    if (!w) throw new BladOsobyDzialajacej('Wskazana osoba działająca nie istnieje albo jest nieaktywna.');
    return zWiersza(w);
  }
  const domyslna = uzytkownik && aktywna(db, uzytkownik.osoba_dzialajaca_id);
  if (domyslna) return zWiersza(domyslna);

  const wszystkie = db.prepare('SELECT COUNT(*) AS ile FROM psa_osoby_dzialajace').get().ile;
  const notariusze = db
    .prepare("SELECT * FROM psa_osoby_dzialajace WHERE aktywny = 1 AND funkcja = 'notariusz'")
    .all();
  if (notariusze.length === 1) return zWiersza(notariusze[0]);
  if (wszystkie === 0) {
    const k = zKonfiguracji();
    if (k) return k;
  }
  throw new BladOsobyDzialajacej(
    'Wskaż osobę działającą przy wpisie (notariusz albo zastępca notarialny) — nie da się jej ustalić jednoznacznie.'
  );
}

/** Skrot dla tras: osoba dzialajaca dla zadania HTTP pracownika. */
function dlaZadania(db, zad) {
  return ustal(db, { wskazanaId: zad.body && zad.body.dzialajacy_id, uzytkownik: zad.uzytkownik });
}

module.exports = { ustal, dlaZadania, FUNKCJE, BladOsobyDzialajacej };
