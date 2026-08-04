'use strict';

/**
 * Termin ustawowy 7 dni (regula domenowa nr 7, art. 300(34) § 1 KSH).
 *
 * Interpretacja przyjeta w tym module: podczas stanu `wstrzymana` zegar jest
 * ZAMROZONY (nie plynie). Po wznowieniu (usunieciu przeszkody) biegnie NOWY,
 * PELNY siedmiodniowy termin liczony od dnia wznowienia - zgodnie z doslownym
 * brzmieniem przepisu: "nie pozniej niz 7 dni od otrzymania zadania; przy
 * przeszkodzie - 7 dni od jej usuniecia" (nie: kontynuacja z zaliczeniem
 * czesci terminu, ktora uplynela przed wstrzymaniem).
 *
 * `dni_wstrzymania` w `psa_sprawy` jest wylacznie SKUMULOWANA STATYSTYKA do
 * audytu i wydrukow - nie wplywa na wyliczenie `termin_do`.
 *
 * Modul jest CZYSTY - operuje wylacznie na datach (RRRR-MM-DD), bez dostepu
 * do bazy i bez efektow ubocznych.
 */

const { TERMINY, PROGI_TERMINU } = require('./przepisy');

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

class BladTerminu extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladTerminu';
  }
}

/**
 * `data_wplywu` w bazie jest DATETIME (zapisywana co do sekundy - sekcja 7),
 * wiec przycinamy do dnia PRZED walidacja formatu - inaczej kazde wywolanie
 * z pelnym znacznikiem czasu odpadaloby na samej dlugosci ciagu.
 */
function sprawdzDate(data, nazwaPola) {
  const dzien = String(data || '').slice(0, 10);
  if (!DATA_ISO.test(dzien)) {
    throw new BladTerminu(`Pole „${nazwaPola}” musi być datą w formacie RRRR-MM-DD.`);
  }
  return dzien;
}

/** Dodaje `dni` dni kalendarzowych do daty ISO. */
function dodajDni(iso, dni) {
  const [r, m, d] = sprawdzDate(iso, 'data').split('-').map(Number);
  const data = new Date(Date.UTC(r, m - 1, d));
  data.setUTCDate(data.getUTCDate() + Number(dni));
  return data.toISOString().slice(0, 10);
}

/** Liczba dni kalendarzowych między dwiema datami ISO (b − a). */
function dniMiedzy(od, doDnia) {
  const a = Date.parse(`${sprawdzDate(od, 'od')}T00:00:00Z`);
  const b = Date.parse(`${sprawdzDate(doDnia, 'do')}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * Wylicza stan terminu sprawy na dany dzień.
 *
 * @param {object} sprawa   { data_wplywu, stan, wstrzymana_od, wznowiona_od }
 * @param {string} dzisiaj  RRRR-MM-DD
 * @returns {{ zamrozony, wstrzymana_od, termin_do, dni_pozostale, po_terminie, pilny }}
 */
function policzTermin(sprawa, dzisiaj) {
  const dzis = sprawdzDate(dzisiaj, 'dzisiaj');
  sprawdzDate(sprawa.data_wplywu, 'data_wplywu');

  if (sprawa.stan === 'wstrzymana') {
    return {
      zamrozony: true,
      wstrzymana_od: sprawa.wstrzymana_od,
      termin_do: null,
      dni_pozostale: null,
      po_terminie: false,
      pilny: false,
    };
  }

  const startBiegu = sprawa.wznowiona_od || sprawa.data_wplywu;
  const terminDo = dodajDni(startBiegu, TERMINY.WPIS_DNI);
  const dniPozostale = dniMiedzy(dzis, terminDo);

  return {
    zamrozony: false,
    wstrzymana_od: null,
    termin_do: terminDo,
    dni_pozostale: dniPozostale,
    po_terminie: dniPozostale < 0,
    pilny: dniPozostale >= 0 && dniPozostale <= PROGI_TERMINU.PILNE_DNI,
  };
}

/**
 * Przejście `weryfikacja → wstrzymana`. Zwraca poprawki do zapisania.
 * Termin od tej chwili jest zamrożony (`policzTermin` zwróci `zamrozony: true`).
 */
function wstrzymaj(sprawa, dzisiaj) {
  if (sprawa.stan === 'wstrzymana') {
    throw new BladTerminu('Sprawa jest już wstrzymana.');
  }
  return { stan: 'wstrzymana', wstrzymana_od: sprawdzDate(dzisiaj, 'dzisiaj') };
}

/**
 * Przejście `wstrzymana → weryfikacja`. Dolicza czas wstrzymania do
 * statystyki `dni_wstrzymania` i ustawia nowy, pełny bieg terminu od dziś.
 */
function wznow(sprawa, dzisiaj) {
  if (sprawa.stan !== 'wstrzymana') {
    throw new BladTerminu('Sprawa nie jest wstrzymana — nie ma czego wznawiać.');
  }
  const dzis = sprawdzDate(dzisiaj, 'dzisiaj');
  const dniTegoWstrzymania = Math.max(dniMiedzy(sprawa.wstrzymana_od, dzis), 0);
  return {
    stan: 'weryfikacja',
    wstrzymana_od: null,
    wznowiona_od: dzis,
    dni_wstrzymania: Number(sprawa.dni_wstrzymania || 0) + dniTegoWstrzymania,
  };
}

module.exports = { BladTerminu, dodajDni, dniMiedzy, policzTermin, wstrzymaj, wznow };
