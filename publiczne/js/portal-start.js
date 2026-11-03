'use strict';

/**
 * Start portalu (R4 zad. 2, P2) — czysta logika, bez JSX (testowana w `testy/portal-start.test.js`).
 *   pozycjeDoZaplatyPortal(stan) -> Array<{idOplaty, opis, kwotaNetto, kwotaBrutto}> — tylko nieopłacone,
 *   banerKrokuWniosku(stan) -> {tekst, akcja: {etykieta, adres}} | null — bieżący krok klienta.
 */

function pozycjeDoZaplatyPortal({ oplaty } = {}) {
  return (oplaty || [])
    .filter((o) => o.status !== 'oplacona')
    .map((o) => ({
      idOplaty: o.id,
      opis: o.opis,
      // API portalu podaje już obie kwoty (`kwota_grosze` = brutto) — nie liczymy VAT drugi raz.
      kwotaNetto: o.kwota_netto_grosze,
      kwotaBrutto: o.kwota_brutto_grosze ?? o.kwota_grosze,
    }));
}

const KROKI_BANERU_WNIOSKU = {
  w_przygotowaniu: { tekst: 'Wniosek o prowadzenie rejestru nie jest jeszcze wysłany.', etykieta: 'Dokończ wniosek' },
  do_uzupelnienia: { tekst: 'Kancelaria prosi o uzupełnienie wniosku.', etykieta: 'Uzupełnij wniosek' },
  umowa_wygenerowana: { tekst: 'Dokumenty do wniosku czekają na Twój podpis.', etykieta: 'Podpisz dokumenty' },
};

function banerKrokuWniosku({ wniosek } = {}) {
  const krok = wniosek && KROKI_BANERU_WNIOSKU[wniosek.status];
  return krok ? { tekst: krok.tekst, akcja: { etykieta: krok.etykieta, adres: '/wniosek' } } : null;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { pozycjeDoZaplatyPortal, banerKrokuWniosku };
