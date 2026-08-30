'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { zmapuj } = require('../server/trasy/krs');

// Zywa odpowiedz API KRS dla KRS 0001114217 (rejestr=P), pobrana 17.08.2026 —
// podstawa weryfikacji mappera przy poprawkach z sekcji 1 (bugfixy importu).
const ODPIS_0001114217 = {
  odpis: {
    rodzaj: 'Aktualny',
    naglowekA: {
      rejestr: 'RejP',
      numerKRS: '0001114217',
      dataCzasOdpisu: '17.08.2026 11:40:10',
      stanZDnia: '03.12.2025',
      dataRejestracjiWKRS: '04.07.2024',
      numerOstatniegoWpisu: 6,
      dataOstatniegoWpisu: '15.07.2025',
      sygnaturaAktSprawyDotyczacejOstatniegoWpisu: 'RDF/783239/25/639',
      oznaczenieSaduDokonujacegoOstatniegoWpisu: 'SYSTEM',
      stanPozycji: 1,
    },
    dane: {
      dzial1: {
        danePodmiotu: {
          formaPrawna: 'PROSTA SPÓŁKA AKCYJNA',
          identyfikatory: { regon: '52906603800000', nip: '5842854219' },
          nazwa: 'HERMES DATA & SOFTWARE SOLUTIONS PROSTA SPÓŁKA AKCYJNA',
        },
        siedzibaIAdres: {
          siedziba: { kraj: 'POLSKA', wojewodztwo: 'POMORSKIE', powiat: 'GDAŃSK', gmina: 'GDAŃSK', miejscowosc: 'GDAŃSK' },
          adres: {
            ulica: 'UL. BOLESŁAWA LEŚMIANA',
            nrDomu: '11',
            nrLokalu: 'U9',
            miejscowosc: 'GDAŃSK',
            kodPocztowy: '80-280',
            poczta: 'GDAŃSK',
            kraj: 'POLSKA',
          },
          adresPocztyElektronicznej: 'JEDRZEJ@GRABSKI.PL',
          adresDoDoreczenElektronicznychWpisanyDoBAE: 'AE:PL-72422-98772-ATIDW-24',
        },
        umowaStatut: {
          informacjaOZawarciuZmianieUmowyStatutu: [{ zawarcieZmianaUmowyStatutu: '21.06.2024' }],
        },
        kapitalPSA: {
          wysokoscKapitaluAkcyjnego: { wartosc: '1,00', waluta: 'PLN' },
          lacznaLiczbaAkcji: '100',
        },
        emisjeAkcji: [{ nazwaSeriiAkcji: 'AZ', liczbaAkcjiWSerii: '100' }],
      },
      dzial2: {
        reprezentacja: {
          nazwaOrganu: 'RADA DYREKTORÓW',
          sposobReprezentacji: 'DO SKŁADANIA OŚWIADCZEŃ W IMIENIU SPÓŁKI JEST UPOWAŻNIONY KAŻDY DYREKTOR SAMODZIELNIE.',
          sklad: [
            {
              nazwisko: { nazwiskoICzlon: 'GRABSKI' },
              imiona: { imie: 'JĘDRZEJ', imieDrugie: 'MARIAN' },
              funkcjaWOrganie: 'DYREKTOR',
              czyZawieszona: false,
            },
          ],
        },
      },
    },
  },
};

test('mapuje daty z KRS (DD.MM.RRRR) na ISO, nie na surowy string', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.equal(wynik.data_utworzenia_spolki, '2024-07-04');
});

// Data ostatniego wpisu do KRS nie jest juz importowana: nie wchodzi do
// tresci rejestru (art. 300(33) § 1 KSH), nie trafia do zadnego pisma
// i nie warunkuje zadnej walidacji - byla wylacznie ciekawostka w formularzu.
test('NIE mapuje juz daty ostatniego wpisu do KRS', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.equal(wynik.data_ostatniego_wpisu_krs, undefined);
});

test('mapuje date zawarcia umowy spolki (akt zalozycielski) - PIERWSZY wpis tablicy, rozna od daty rejestracji w KRS', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.equal(wynik.data_zawarcia_umowy_spolki, '2024-06-21');
  assert.notEqual(wynik.data_zawarcia_umowy_spolki, wynik.data_utworzenia_spolki);
});

test('obcina REGON z 14 zer koncowych do REGON-9', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.equal(wynik.regon, '529066038');
});

test('mapuje kapital akcyjny z dzial1.kapitalPSA (przecinek dziesietny -> grosze)', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.equal(wynik.kapital_akcyjny_grosze, 100);
});

test('mapuje adres do e-doreczen z rzeczywistej sciezki BAE', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.equal(wynik.adres_edorecze, 'AE:PL-72422-98772-ATIDW-24');
});

test('sad rejestrowy nie jest zgadywany z pola o ostatnim wpisie, tylko z fallbacku TERYT wg gminy siedziby', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  // Spolka ma siedzibe w Gdansku (dzial1.siedzibaIAdres.siedziba.gmina) -
  // baza sadow rejestrowych (server/dane/sady-rejestrowe.json) rozstrzyga
  // to jednoznacznie na VII Wydzial Gospodarczy KRS.
  assert.equal(wynik.sad_rejestrowy, 'Sąd Rejonowy Gdańsk-Północ w Gdańsku');
  assert.equal(wynik.wydzial, 'VII Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(wynik.sad_rejestrowy_propozycja, true);
});

test('mapuje sklad organu z dzial2.reprezentacja.sklad (obiekt, nie tablica)', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.deepEqual(wynik.sklad_organu, [
    { nazwisko: 'GRABSKI', imiona: 'JĘDRZEJ MARIAN', funkcja: 'DYREKTOR' },
  ]);
});

test('reszta pol podstawowych (nazwa, forma, NIP, adres) bez zmian', () => {
  const wynik = zmapuj(ODPIS_0001114217, '0001114217');
  assert.equal(wynik.nazwa, 'HERMES DATA & SOFTWARE SOLUTIONS PROSTA SPÓŁKA AKCYJNA');
  assert.equal(wynik.forma_prawna, 'PROSTA SPÓŁKA AKCYJNA');
  assert.equal(wynik.nip, '5842854219');
  assert.equal(wynik.miejscowosc, 'GDAŃSK');
  assert.equal(wynik.kod_pocztowy, '80-280');
  assert.equal(wynik.email, 'JEDRZEJ@GRABSKI.PL');
});
