'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ustalSadRejestrowy } = require('../server/logika/sad-rejestrowy');

// Synteyczna baza w stylu przykladu z promptu (XVII Wydzial Gospodarczy KRS
// w Czestochowie - dla obszaru Sadu Okregowego w Czestochowie), do testu
// samego mechanizmu dopasowania. Prawdziwa tabela (server/dane/sady-rejestrowe.json)
// jest dzis pusta - patrz README obok tego pliku.
const BAZA_TESTOWA = {
  sady_okregowe: [
    {
      id: 'so-czestochowa',
      nazwa: 'Sąd Okręgowy w Częstochowie',
      wydzial_krs: { sad: 'Sąd Rejonowy w Częstochowie', numer_wydzialu: 'XVII', nazwa_pelna: 'XVII Wydział Gospodarczy Krajowego Rejestru Sądowego' },
    },
    {
      id: 'so-gdansk',
      nazwa: 'Sąd Okręgowy w Gdańsku',
      wydzial_krs: { sad: 'Sąd Rejonowy Gdańsk-Północ w Gdańsku', numer_wydzialu: 'VII', nazwa_pelna: 'VII Wydział Gospodarczy Krajowego Rejestru Sądowego' },
    },
  ],
  powiaty: [
    { teryt: '2401', powiat: 'CZĘSTOCHOWA', wojewodztwo: 'ŚLĄSKIE', sad_okregowy_id: 'so-czestochowa' },
    { teryt: '2201', powiat: 'GDAŃSK', wojewodztwo: 'POMORSKIE', sad_okregowy_id: 'so-gdansk' },
  ],
  wyjatki_gminne: [
    { powiat: 'CZĘSTOCHOWA', wojewodztwo: 'ŚLĄSKIE', gmina: 'KONIECPOL', sad_okregowy_id: 'so-gdansk' },
  ],
};

test('dopasowuje sad okregowy i wydzial KRS po powiecie i wojewodztwie', () => {
  const wynik = ustalSadRejestrowy({ wojewodztwo: 'POMORSKIE', powiat: 'GDAŃSK', gmina: 'GDAŃSK' }, BAZA_TESTOWA);
  assert.deepEqual(wynik, {
    sad_okregowy: 'Sąd Okręgowy w Gdańsku',
    sad_rejestrowy: 'Sąd Rejonowy Gdańsk-Północ w Gdańsku',
    wydzial: 'VII Wydział Gospodarczy Krajowego Rejestru Sądowego',
  });
});

test('dopasowanie jest niewrazliwe na wielkosc liter (KRS zwraca WIELKIMI LITERAMI)', () => {
  const wynik = ustalSadRejestrowy({ wojewodztwo: 'pomorskie', powiat: 'gdańsk', gmina: 'gdańsk' }, BAZA_TESTOWA);
  assert.equal(wynik.sad_okregowy, 'Sąd Okręgowy w Gdańsku');
});

test('wyjatek gminny ma pierwszenstwo przed dopasowaniem po samym powiecie', () => {
  const zwykly = ustalSadRejestrowy({ wojewodztwo: 'ŚLĄSKIE', powiat: 'CZĘSTOCHOWA', gmina: 'CZĘSTOCHOWA' }, BAZA_TESTOWA);
  assert.equal(zwykly.sad_okregowy, 'Sąd Okręgowy w Częstochowie');

  const wyjatkowy = ustalSadRejestrowy({ wojewodztwo: 'ŚLĄSKIE', powiat: 'CZĘSTOCHOWA', gmina: 'KONIECPOL' }, BAZA_TESTOWA);
  assert.equal(wyjatkowy.sad_okregowy, 'Sąd Okręgowy w Gdańsku');
});

test('brak dopasowania (nieznany powiat, brak powiatu) daje null - zadnej falszywej propozycji', () => {
  assert.equal(ustalSadRejestrowy({ wojewodztwo: 'MAZOWIECKIE', powiat: 'NIEZNANY POWIAT' }, BAZA_TESTOWA), null);
  assert.equal(ustalSadRejestrowy({}, BAZA_TESTOWA), null);
  assert.equal(ustalSadRejestrowy(undefined, BAZA_TESTOWA), null);
});

test('prawdziwa baza produkcyjna jest dzis pusta - kazde zapytanie daje null, bez wyjatku', () => {
  assert.equal(ustalSadRejestrowy({ wojewodztwo: 'POMORSKIE', powiat: 'GDAŃSK', gmina: 'GDAŃSK' }), null);
});
