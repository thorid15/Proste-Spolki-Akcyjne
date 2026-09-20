'use strict';

/**
 * Dziennik dostępu do danych osobowych (blok D4, sesja 8) — WĄSKI zakres:
 * tylko momenty realnego wglądu w dane wrażliwe albo wyniesienia ich
 * z systemu (informacja z rejestru, raport dla sądu, eksport, pobranie
 * pliku). Świadomie NIE każde wyświetlenie listy/kokpitu — patrz uzasadnienie
 * przy migracji v16.
 *
 * Append-only, jak `psa_zdarzenia` — ale to zupełnie osobna tabela, bez
 * wpływu na łańcuch skrótów treści rejestru.
 */

const czas = require('../pomocnicze/czas');

const AKCJE = {
  INFORMACJA_Z_REJESTRU: 'informacja_z_rejestru',
  RAPORT_SAD: 'raport_sad',
  EKSPORT: 'eksport',
  POBRANIE_PLIKU: 'pobranie_pliku',
  // Dane kancelarii i stawki trafiaja do kazdej wystawianej umowy, wiec ich
  // zmiana jest zdarzeniem wartym zapisania — tak samo jak wglad w akta.
  ZMIANA_USTAWIEN: 'zmiana_ustawien',
  // Naprawa Z-152/P-009: zwykly odczyt rejestru (bez formalnego wydania
  // "informacji z rejestru") NIE byl dotad rejestrowany w ogole - w polaczeniu
  // z Z-150 (wyciek nadmiarowych pol) oznaczalo to, ze wglad w dane wrazliwe
  // przez rola "spolka"/"organ" portalu nie zostawial ZADNEGO sladu.
  ODCZYT_REJESTRU: 'odczyt_rejestru',
};

function zapisz(db, { kto, typKto, spolkaId = null, osobaId = null, akcja, opis = null }) {
  db.prepare(
    `INSERT INTO psa_dziennik_dostepu (chwila, kto, typ_kto, spolka_id, osoba_id, akcja, opis)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(czas.terazIso(), kto, typKto, spolkaId, osobaId, akcja, opis);
}

const OKNO_DEDUPLIKACJI_MIN = 15;

/**
 * Odczyt rejestru przez konto PORTALOWE (sekcja 2.3 naprawy) - wyjatek od
 * "waskiego zakresu" z naglowka tego modulu: to jedyne miejsce, w ktorym
 * KLIENT (nie kancelaria) moze zobaczyc niezamaskowane dane wrazliwe
 * (PESEL, adres, AML/PEP) innych osob - rola "spolka" widzi je w calosci
 * (art. 300(35) KSH). Pieciu odswiezen ekranu w kilka minut nie moze dac
 * pieciu wpisow, inaczej dziennik traci wartosc dowodowa - std jeden wpis
 * na (spolka, konto, okno 15 minut). Odczyty W PELNI zamaskowane (rola
 * akcjonariusza wzgledem WSPOLakcjonariuszy) nie sa warte odnotowania -
 * nic wrazliwego nie wyszlo.
 */
function zapiszOdczytRejestruPortalu(db, { kto, spolkaId, liczbaOsob, zamaskowane }) {
  if (zamaskowane) return;
  // Ta sama funkcja formatujaca co przy zapisie (`chwila` w tabeli) - inny
  // format dawalby bezsensowne porownanie stringow ponizej.
  const graniczna = czas.terazIso(new Date(Date.now() - OKNO_DEDUPLIKACJI_MIN * 60 * 1000));
  const istniejacy = db
    .prepare(
      `SELECT id FROM psa_dziennik_dostepu
        WHERE typ_kto = 'portal' AND kto = ? AND spolka_id = ? AND akcja = ? AND chwila >= ?
        LIMIT 1`
    )
    .get(kto, spolkaId, AKCJE.ODCZYT_REJESTRU, graniczna);
  if (istniejacy) return;
  zapisz(db, {
    kto,
    typKto: 'portal',
    spolkaId,
    akcja: AKCJE.ODCZYT_REJESTRU,
    opis: `odczyt stanu rejestru — dane ${liczbaOsob} ${liczbaOsob === 1 ? 'osoby' : 'osób'} niezamaskowane`,
  });
}

module.exports = { zapisz, zapiszOdczytRejestruPortalu, AKCJE };
