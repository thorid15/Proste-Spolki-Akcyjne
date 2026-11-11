'use strict';

/**
 * Jeden proces dzienny (Faza 2): opłaty za prowadzenie rejestru (U-30), przypomnienie o kolejnym
 * roku prowadzenia (e-mail do spółki 30 dni wcześniej), retencja danych klienta z wniosków
 * odrzuconych i porzuconych (U-19) oraz retencja dziennika (D-122).
 */

const fs = require('node:fs');
const path = require('node:path');
const konfiguracja = require('./konfiguracja');
const czas = require('./pomocnicze/czas');
const oplaty = require('./oplaty');
const przepisy = require('./logika/przepisy');
const terminy = require('./logika/terminy');
const ustawienia = require('./logika/ustawienia');
const dziennik = require('./logika/dziennik-dostepu');
const daneSpolki = require('./dane/spolki');
const daneWnioski = require('./dane/wnioski');

const DNI_PRZYPOMNIENIA = 30;
const DNI_PORZUCENIA = 90;
const AKCJA_PRZYPOMNIENIA = 'przypomnienie_oplaty';

const dataPl = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const zl = (grosze) => `${oplaty.kwota(grosze).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} zł`;

/** E-mail do spółki z rejestrem płatnym rocznie — raz, 30 dni przed rocznicą otwarcia. */
async function wyslijPrzypomnienia(db, { dzis = czas.dzisIso(), poczta = require('./poczta') } = {}) {
  let wyslane = 0;
  for (const s of daneSpolki.zRejestrem(db)) {
    if (s.platnosc !== 'roczna' || !s.email || s.data_zamkniecia) continue;
    const otwarcie = czas.dzienLokalny(s.data_otwarcia);
    let k = 1;
    while (oplaty.poczatekOkresu(otwarcie, k, 12) <= dzis) k += 1;
    const rocznica = oplaty.poczatekOkresu(otwarcie, k, 12);
    const klucz = `${s.id}:${rocznica}`;
    if (terminy.dniMiedzy(dzis, rocznica) > DNI_PRZYPOMNIENIA || dziennik.zapisano(db, AKCJA_PRZYPOMNIENIA, klucz)) continue;
    const netto = przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE;
    const w = await poczta.wyslij({
      do: s.email,
      temat: 'Kolejny rok prowadzenia rejestru akcjonariuszy',
      tekst: [
        'Dzień dobry,',
        '',
        `${dataPl(rocznica)} rozpoczyna się kolejny rok prowadzenia rejestru akcjonariuszy spółki ${s.nazwa}. ` +
          `Opłata za ten rok wynosi ${zl(przepisy.obliczBrutto(netto))} brutto (${zl(netto)} netto); pojawi się w portalu w dniu rozpoczęcia roku.`,
        '',
        `Kancelaria Notarialna, notariusz ${ustawienia.kancelaria(db).notariusz_mianownik}`,
      ].join('\n'),
    });
    if (!w.wyslano) continue;
    dziennik.zapisz(db, { kto: 'proces dzienny', typKto: 'pracownik', spolkaId: s.id, akcja: AKCJA_PRZYPOMNIENIA, opis: klucz });
    wyslane += 1;
  }
  return wyslane;
}

/** U-19: wniosek odrzucony albo bez zmian przez 90 dni traci dane klienta. Zwraca liczbę wniosków. */
function retencjaWnioskow(db, { dzis = czas.dzisIso() } = {}) {
  const wnioski = daneWnioski.doRetencji(db, terminy.dodajDni(dzis, -DNI_PORZUCENIA));
  for (const id of wnioski) {
    const pliki = db.transaction(() => daneWnioski.usunDaneKlienta(db, id))();
    for (const p of pliki) fs.rmSync(path.join(konfiguracja.KATALOG_DOKUMENTOW, path.basename(p)), { force: true });
  }
  return wnioski.length;
}

async function procesDzienny(db, { dzis = czas.dzisIso(), poczta } = {}) {
  const wynik = {
    oplaty: oplaty.naliczProwadzenie(db, { dzis }),
    przypomnienia: await wyslijPrzypomnienia(db, { dzis, poczta }),
    wnioski: retencjaWnioskow(db, { dzis }),
  };
  dziennik.usunPrzeterminowane(db);
  return wynik;
}

module.exports = { procesDzienny, wyslijPrzypomnienia, retencjaWnioskow };
