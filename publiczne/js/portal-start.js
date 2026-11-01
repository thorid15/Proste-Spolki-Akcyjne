'use strict';

/**
 * Start portalu (R4 zad. 2, P2) — czysta logika, bez JSX (testowana w `testy/portal-start.test.js`).
 *   pozycjeDoZaplatyPortal(stan) -> Array<{idOplaty, opis, kwotaBrutto}> — tylko nieopłacone,
 *   banerKrokuWniosku(stan) -> {tekst, akcja: {etykieta, adres}} | null — bieżący krok klienta.
 */

function pozycjeDoZaplatyPortal({ oplaty } = {}) {
  return (oplaty || [])
    .filter((o) => o.status !== 'oplacona')
    .map((o) => ({
      idOplaty: o.id,
      opis: o.opis,
      // Ta sama formuła co `przepisy.obliczBrutto` po stronie serwera.
      kwotaBrutto: Math.round((Number(o.kwota_grosze) * (100 + Number(o.stawka_vat_procent ?? 23))) / 100),
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
