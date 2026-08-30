'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ustalSadRejestrowy } = require('../server/logika/sad-rejestrowy');

// Synteyczna baza w stylu przykladu z promptu (XVII Wydzial Gospodarczy KRS
// w Czestochowie - dla obszaru Sadu Okregowego w Czestochowie), do testu
// samego mechanizmu dopasowania - niezaleznie od prawdziwej bazy produkcyjnej.
const BAZA_TESTOWA = {
  wydzialy: [
    { id: 'czestochowa-xvii', sad: 'Sąd Rejonowy w Częstochowie', numer_wydzialu: 'XVII', nazwa_pelna: 'XVII Wydział Gospodarczy Krajowego Rejestru Sądowego' },
    { id: 'gdansk-vii', sad: 'Sąd Rejonowy Gdańsk-Północ w Gdańsku', numer_wydzialu: 'VII', nazwa_pelna: 'VII Wydział Gospodarczy Krajowego Rejestru Sądowego' },
  ],
  gminy: [
    { gmina: 'CZĘSTOCHOWA', wydzial_id: 'czestochowa-xvii' },
    { gmina: 'GDAŃSK', wydzial_id: 'gdansk-vii' },
  ],
};

test('dopasowuje sad rejestrowy i wydzial KRS po gminie (przyklad z promptu: Częstochowa)', () => {
  const wynik = ustalSadRejestrowy({ gmina: 'CZĘSTOCHOWA' }, BAZA_TESTOWA);
  assert.deepEqual(wynik, {
    sad_rejestrowy: 'Sąd Rejonowy w Częstochowie',
    wydzial: 'XVII Wydział Gospodarczy Krajowego Rejestru Sądowego',
  });
});

test('dopasowanie jest niewrazliwe na wielkosc liter (KRS zwraca WIELKIMI LITERAMI)', () => {
  const wynik = ustalSadRejestrowy({ gmina: 'gdańsk' }, BAZA_TESTOWA);
  assert.equal(wynik.sad_rejestrowy, 'Sąd Rejonowy Gdańsk-Północ w Gdańsku');
});

test('brak dopasowania (nieznana gmina, brak gminy) daje null - zadnej falszywej propozycji', () => {
  assert.equal(ustalSadRejestrowy({ gmina: 'NIEZNANA GMINA' }, BAZA_TESTOWA), null);
  assert.equal(ustalSadRejestrowy({}, BAZA_TESTOWA), null);
  assert.equal(ustalSadRejestrowy(undefined, BAZA_TESTOWA), null);
});

// ─────────────────────────────────────────────────────────────
// Baza produkcyjna (server/dane/sady-rejestrowe.json) - zbudowana z dwoch
// wykazow MS (stan luty 2025): Wlasciwosc sadow powszechnych + Lista
// Wydzialow Gospodarczych KRS. Testy nizej pilnuja, zeby nie zepsuc jej przy
// przyszlych aktualizacjach.
// ─────────────────────────────────────────────────────────────

test('baza produkcyjna: dopasowuje kilka duzych miast (bez wewnetrznego podzialu na dzielnice)', () => {
  assert.equal(ustalSadRejestrowy({ gmina: 'GDAŃSK' }).wydzial, 'VII Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'WROCŁAW' }).wydzial, 'VI Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'POZNAŃ' }).wydzial, 'VIII Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'ŁÓDŹ' }).wydzial, 'XX Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'SZCZECIN' }).wydzial, 'XIII Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'LUBLIN' }).wydzial, 'VI Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'KATOWICE' }).wydzial, 'VIII Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'CZĘSTOCHOWA' }).wydzial, 'XVII Wydział Gospodarczy Krajowego Rejestru Sądowego');
});

test('baza produkcyjna: gminy przylegle do Krakowa/Warszawy sa rozstrzygane normalnie', () => {
  assert.equal(ustalSadRejestrowy({ gmina: 'WIELICZKA' }).wydzial, 'XII Wydział Gospodarczy Krajowego Rejestru Sądowego');
  assert.equal(ustalSadRejestrowy({ gmina: 'PIASECZNO' }).wydzial, 'XIV Wydział Gospodarczy Krajowego Rejestru Sądowego');
});

test('baza produkcyjna: Warszawa i Krakow celowo NIE maja wpisu (podzial na poziomie dzielnicy, ktorej API KRS nie zwraca)', () => {
  assert.equal(ustalSadRejestrowy({ gmina: 'WARSZAWA' }), null);
  assert.equal(ustalSadRejestrowy({ gmina: 'KRAKÓW' }), null);
});

test('baza produkcyjna: pokrywa wiekszosc gmin w Polsce (>2000 z ok. 2477)', () => {
  const baza = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'dane', 'sady-rejestrowe.json'), 'utf8'));
  assert.ok(baza.gminy.length > 2000, `oczekiwano >2000 gmin w bazie, jest ${baza.gminy.length}`);
  assert.ok(baza.wydzialy.length >= 20, `oczekiwano >=20 wydzialow, jest ${baza.wydzialy.length}`);
});
