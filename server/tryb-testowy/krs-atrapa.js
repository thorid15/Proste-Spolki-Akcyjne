'use strict';

/**
 * Atrapa Otwartego API KRS (T3) — wylacznie dla numerow z danych testowych.
 * Kazdy inny numer idzie do prawdziwego API (`server/trasy/krs.js`).
 *
 * Odpowiedz ma ksztalt surowego odpisu (`OdpisAktualny`), wiec przechodzi
 * przez ten sam mapper (`zmapuj`) co odpowiedz prawdziwa. Dane fikcyjne.
 */

function odpis({ krs, nazwa, regon, nip, ulica, nrDomu, kod, miasto, rejestracja, kapital, akcje, seria, zarzad }) {
  return {
    odpis: {
      rodzaj: 'Aktualny',
      naglowekA: {
        rejestr: 'RejP',
        numerKRS: krs,
        dataRejestracjiWKRS: rejestracja,
        stanPozycji: 1,
      },
      dane: {
        dzial1: {
          danePodmiotu: { formaPrawna: 'PROSTA SPÓŁKA AKCYJNA', identyfikatory: { regon, nip }, nazwa },
          siedzibaIAdres: {
            siedziba: { kraj: 'POLSKA', wojewodztwo: 'POMORSKIE', powiat: miasto, gmina: miasto, miejscowosc: miasto },
            adres: { ulica, nrDomu, miejscowosc: miasto, kodPocztowy: kod, poczta: miasto, kraj: 'POLSKA' },
          },
          umowaStatut: { informacjaOZawarciuZmianieUmowyStatutu: [{ zawarcieZmianaUmowyStatutu: rejestracja }] },
          kapitalPSA: { wysokoscKapitaluAkcyjnego: { wartosc: kapital, waluta: 'PLN' }, lacznaLiczbaAkcji: String(akcje) },
          emisjeAkcji: [{ nazwaSeriiAkcji: seria, liczbaAkcjiWSerii: String(akcje) }],
        },
        dzial2: {
          reprezentacja: {
            nazwaOrganu: 'ZARZĄD',
            sposobReprezentacji: 'DO SKŁADANIA OŚWIADCZEŃ W IMIENIU SPÓŁKI UPOWAŻNIONY JEST KAŻDY CZŁONEK ZARZĄDU SAMODZIELNIE.',
            sklad: zarzad.map(([nazwisko, imie]) => ({
              nazwisko: { nazwiskoICzlon: nazwisko },
              imiona: { imie },
              funkcjaWOrganie: 'PREZES ZARZĄDU',
              czyZawieszona: false,
            })),
          },
        },
      },
    },
  };
}

const ODPISY = {
  '0000990001': odpis({
    krs: '0000990001', nazwa: 'ALFA TESTOWA PROSTA SPÓŁKA AKCYJNA', regon: '000000000', nip: '0000000000',
    ulica: 'UL. PRÓBNA', nrDomu: '1', kod: '80-001', miasto: 'GDAŃSK', rejestracja: '02.01.2026',
    kapital: '1000,00', akcje: 1000, seria: 'A', zarzad: [['ZARZĄDCZY', 'ZBIGNIEW']],
  }),
  '0000990002': odpis({
    krs: '0000990002', nazwa: 'BETA PRZENOSZONA PROSTA SPÓŁKA AKCYJNA', regon: '000000001', nip: '0000000001',
    ulica: 'UL. FIKCYJNA', nrDomu: '2', kod: '80-002', miasto: 'GDAŃSK', rejestracja: '15.03.2025',
    kapital: '500,00', akcje: 500, seria: 'A', zarzad: [['PRZYKŁADOWA', 'BEATA']],
  }),
  '0000990003': odpis({
    krs: '0000990003', nazwa: 'GAMMA ZGŁOSZENIOWA PROSTA SPÓŁKA AKCYJNA', regon: '000000002', nip: '0000000002',
    ulica: 'UL. TESTOWA', nrDomu: '3', kod: '80-003', miasto: 'SOPOT', rejestracja: '01.06.2026',
    kapital: '100,00', akcje: 100, seria: 'A', zarzad: [['GAMMOWSKI', 'GRZEGORZ']],
  }),
};

/** Odpowiedz w ksztalcie `fetch` (Response) albo `null` — numer spoza atrapy. */
function odpowiedz(numerKrs) {
  const tresc = ODPISY[String(numerKrs)];
  if (!tresc) return null;
  return { status: 200, ok: true, json: async () => JSON.parse(JSON.stringify(tresc)) };
}

module.exports = { odpowiedz, NUMERY: Object.keys(ODPISY) };
