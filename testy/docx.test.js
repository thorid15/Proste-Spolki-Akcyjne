'use strict';

/**
 * Warstwa `.docx`: kontener ZIP bez zależności (`logika/zip.js`) i wypełnianie
 * wzorów danymi rejestru (`logika/docx.js`).
 *
 * Dwa poziomy:
 *   — jednostkowo na dokumentach składanych w locie, żeby każdy tryb sekcji
 *     dało się sprawdzić osobno,
 *   — na PRAWDZIWYCH wzorach z katalogu `wzory/`, bo to one trafiają do pism
 *     i to na nich psuje się formatowanie z Worda.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const zip = require('../server/logika/zip');
const docx = require('../server/logika/docx');

const KATALOG_WZOROW = path.join(__dirname, '..', 'wzory');

// ─────────────────────────────────────────────────────────────
// Pomocnicze: minimalny dokument Worda
// ─────────────────────────────────────────────────────────────

function akapit(...przebiegi) {
  const runy = przebiegi
    .map((tekst) => `<w:r><w:t xml:space="preserve">${tekst}</w:t></w:r>`)
    .join('');
  return `<w:p>${runy}</w:p>`;
}

function wiersz(...komorki) {
  return `<w:tr>${komorki.map((k) => `<w:tc>${akapit(k)}</w:tc>`).join('')}</w:tr>`;
}

function dokument(...tresc) {
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${tresc.join('')}</w:body></w:document>`;
  return zip.zapisz([{ nazwa: 'word/document.xml', flagi: 0, czas: 0, data: 0x21, dane: Buffer.from(xml, 'utf8') }]);
}

function wypelnijNaTekst(plik, dane) {
  const wynik = docx.wypelnij(plik, dane);
  return { ...wynik, tekst: docx.tekst(wynik.plik) };
}

// ─────────────────────────────────────────────────────────────
// ZIP
// ─────────────────────────────────────────────────────────────

test('zip: zapis i odczyt zachowują treść', () => {
  const tresc = Buffer.from('a'.repeat(5000) + 'ąćęłńóśźż', 'utf8');
  const drobiazg = Buffer.from('x', 'utf8');
  const archiwum = zip.zapisz([
    { nazwa: 'duzy.txt', flagi: 0, dane: tresc },
    { nazwa: 'katalog/maly.txt', flagi: 0, dane: drobiazg },
  ]);
  const czesci = zip.rozpakujWszystko(archiwum);
  assert.deepEqual(czesci.get('duzy.txt'), tresc);
  assert.deepEqual(czesci.get('katalog/maly.txt'), drobiazg);
});

test('zip: dane nieściśliwe zapisujemy bez kompresji zamiast je powiększać', () => {
  const wpisy = zip.czytaj(zip.zapisz([{ nazwa: 'x', flagi: 0, dane: Buffer.from('ab') }]));
  assert.equal(wpisy[0].metoda, 0);
  assert.deepEqual(zip.rozpakuj(wpisy[0]), Buffer.from('ab'));
});

test('zip: niezmieniony wpis przechodzi bajt w bajt', () => {
  const oryginal = zip.zapisz([{ nazwa: 'a.txt', flagi: 0, dane: Buffer.from('t'.repeat(400)) }]);
  const wpisy = zip.czytaj(oryginal);
  const przepisany = zip.zapisz(wpisy);
  assert.deepEqual(zip.czytaj(przepisany)[0].daneSkompresowane, wpisy[0].daneSkompresowane);
});

test('zip: uszkodzone archiwum daje czytelny błąd, nie wyjątek z zlib', () => {
  assert.throws(() => zip.czytaj(Buffer.from('to nie jest zip')), /nie jest archiwum ZIP/);
});

test('zip: naruszona suma kontrolna jest wykrywana', () => {
  const archiwum = zip.zapisz([{ nazwa: 'a.txt', flagi: 0, dane: Buffer.from('x'.repeat(200)) }]);
  const wpis = zip.czytaj(archiwum)[0];
  wpis.crc = (wpis.crc ^ 0xff) >>> 0;
  assert.throws(() => zip.rozpakuj(wpis), /Suma kontrolna/);
});

// ─────────────────────────────────────────────────────────────
// Podstawianie wartości
// ─────────────────────────────────────────────────────────────

test('docx: podstawia proste klucze', () => {
  const { tekst } = wypelnijNaTekst(dokument(akapit('Spółka {{spolka_firma}} z siedzibą w {{spolka_siedziba_miejscownik}}.')), {
    spolka_firma: 'CHARLIE UNICORN AI',
    spolka_siedziba_miejscownik: 'Warszawie',
  });
  assert.equal(tekst, 'Spółka CHARLIE UNICORN AI z siedzibą w Warszawie.');
});

test('docx: klucz bez wartości nie znika po cichu — zostaje myślnik i wpis na liście braków', () => {
  const { tekst, brakujace } = wypelnijNaTekst(dokument(akapit('Znak: {{sprawa_numer}}')), {});
  assert.match(tekst, /Znak: —/);
  assert.deepEqual(brakujace, ['sprawa_numer']);
});

test('docx: wartość ze znakami XML jest escapowana, a dokument zostaje poprawny', () => {
  const wynik = docx.wypelnij(dokument(akapit('{{spolka_firma}}')), {
    spolka_firma: 'A & B <sp. z o.o.> "X"',
  });
  const xml = zip.rozpakujWszystko(wynik.plik).get('word/document.xml').toString('utf8');
  assert.match(xml, /A &amp; B &lt;sp\. z o\.o\.&gt;/);
  assert.equal(docx.tekst(wynik.plik), 'A & B <sp. z o.o.> "X"');
});

test('docx: nowa linia w wartości staje się złamaniem wiersza Worda', () => {
  const wynik = docx.wypelnij(dokument(akapit('{{adresat_adres}}')), {
    adresat_adres: 'Jan Kowalski\n80-180 Gdańsk',
  });
  const xml = zip.rozpakujWszystko(wynik.plik).get('word/document.xml').toString('utf8');
  assert.match(xml, /<w:br\/>/);
  assert.equal(docx.tekst(wynik.plik), 'Jan Kowalski\n80-180 Gdańsk');
});

test('docx: {{klucz_slownie}} zapisuje liczbę i datę słowami', () => {
  const { tekst } = wypelnijNaTekst(
    dokument(akapit('{{liczba_akcji_slownie}} — {{pismo_data_slownie}}')),
    { liczba_akcji: 1250, pismo_data: '2026-08-13' }
  );
  assert.equal(tekst, 'tysiąc dwieście pięćdziesiąt — 13 sierpnia 2026');
});

// ─────────────────────────────────────────────────────────────
// Trzy tryby sekcji
// ─────────────────────────────────────────────────────────────

test('docx: sekcja w jednym akapicie powtarza sam fragment tekstu', () => {
  const plik = dokument(akapit('Adresat: {{#adresat_spolka}}{{spolka_organ}} spółki — {{/adresat_spolka}}{{adresat_nazwa}}'));
  assert.equal(
    wypelnijNaTekst(plik, { adresat_spolka: 1, spolka_organ: 'Zarząd', adresat_nazwa: 'X' }).tekst,
    'Adresat: Zarząd spółki — X'
  );
  assert.equal(
    wypelnijNaTekst(plik, { adresat_spolka: 0, spolka_organ: 'Zarząd', adresat_nazwa: 'X' }).tekst,
    'Adresat: X'
  );
});

test('docx: sekcja w wierszu tabeli powiela cały wiersz', () => {
  const plik = dokument(
    '<w:tbl>' +
      wiersz('Akcjonariusz', 'Liczba') +
      wiersz('{{#pozycje}}{{pozycja_akcjonariusz}}', '{{pozycja_liczba}}{{/pozycje}}') +
      '</w:tbl>'
  );
  const { tekst, brakujace } = wypelnijNaTekst(plik, {
    pozycje: [
      { pozycja_akcjonariusz: 'Jan Kowalski', pozycja_liczba: 250 },
      { pozycja_akcjonariusz: 'Anna Nowak', pozycja_liczba: 750 },
    ],
  });
  assert.deepEqual(brakujace, []);
  assert.equal(tekst, 'Akcjonariusz\nLiczba\nJan Kowalski\n250\nAnna Nowak\n750');
});

test('docx: pusta lista w tabeli zostawia sam nagłówek', () => {
  const plik = dokument(
    '<w:tbl>' +
      wiersz('Akcjonariusz', 'Liczba') +
      wiersz('{{#pozycje}}{{pozycja_akcjonariusz}}', '{{pozycja_liczba}}{{/pozycje}}') +
      '</w:tbl>'
  );
  assert.equal(wypelnijNaTekst(plik, { pozycje: [] }).tekst, 'Akcjonariusz\nLiczba');
});

test('docx: znaczniki w jednej komórce to tryb tekstowy — wiersz zostaje', () => {
  // Rozróżnienie jest celowe: o powieleniu CAŁEGO wiersza decyduje to, że
  // znaczniki stoją w różnych akapitach tego samego <w:tr>. Autor wzoru
  // z jedną kolumną rozdziela je na dwa akapity w komórce.
  const jednaKomorka = dokument('<w:tbl>' + wiersz('{{#pozycje}}{{pozycja_opis}}{{/pozycje}}') + '</w:tbl>');
  assert.equal(wypelnijNaTekst(jednaKomorka, { pozycje: [] }).tekst, '');

  const dwaAkapity = dokument(
    '<w:tbl><w:tr><w:tc>' +
      akapit('{{#pozycje}}') +
      akapit('{{pozycja_opis}}') +
      akapit('{{/pozycje}}') +
      '</w:tc></w:tr></w:tbl>'
  );
  assert.equal(
    wypelnijNaTekst(dwaAkapity, { pozycje: [{ pozycja_opis: 'a' }, { pozycja_opis: 'b' }] }).tekst,
    'a\nb'
  );
});

test('docx: sekcja rozpięta na akapitach powiela to, co pomiędzy, a znaczniki znikają', () => {
  const plik = dokument(
    akapit('Załączniki:'),
    akapit('{{#zalaczniki}}'),
    akapit('{{zalacznik_lp}}. {{zalacznik_nazwa}}'),
    akapit('{{/zalaczniki}}'),
    akapit('Koniec.')
  );
  const { tekst } = wypelnijNaTekst(plik, {
    zalaczniki: [
      { zalacznik_lp: 1, zalacznik_nazwa: 'umowa zbycia akcji' },
      { zalacznik_lp: 2, zalacznik_nazwa: 'pełnomocnictwo' },
    ],
  });
  assert.equal(tekst, 'Załączniki:\n1. umowa zbycia akcji\n2. pełnomocnictwo\nKoniec.');
});

test('docx: sekcja warunkowa 0/1 na akapitach włącza i wyłącza blok', () => {
  const plik = dokument(akapit('A'), akapit('{{#spolka_vat}}'), akapit('Podatek VAT.'), akapit('{{/spolka_vat}}'), akapit('B'));
  assert.equal(wypelnijNaTekst(plik, { spolka_vat: 1 }).tekst, 'A\nPodatek VAT.\nB');
  assert.equal(wypelnijNaTekst(plik, { spolka_vat: 0 }).tekst, 'A\nB');
});

test('docx: ta sama sekcja użyta kilka razy nie łączy się w jedną', () => {
  const plik = dokument(
    akapit('{{#adresat_spolka}}Pierwszy{{/adresat_spolka}}'),
    akapit('środek'),
    akapit('{{#adresat_spolka}}Drugi{{/adresat_spolka}}')
  );
  assert.equal(wypelnijNaTekst(plik, { adresat_spolka: 1 }).tekst, 'Pierwszy\nśrodek\nDrugi');
  assert.equal(wypelnijNaTekst(plik, { adresat_spolka: 0 }).tekst, '\nśrodek\n');
});

test('docx: sekcja w sekcji rozwiązuje klucze najpierw z pozycji, potem z danych nadrzędnych', () => {
  const plik = dokument(
    akapit('{{#serie}}'),
    akapit('Seria {{seria}} spółki {{spolka_firma}}'),
    akapit('{{#akcje}}'),
    akapit('— {{numer}} ({{seria}})'),
    akapit('{{/akcje}}'),
    akapit('{{/serie}}')
  );
  const { tekst } = wypelnijNaTekst(plik, {
    spolka_firma: 'PSA',
    serie: [{ seria: 'A', akcje: [{ numer: 1 }, { numer: 2 }] }],
  });
  assert.equal(tekst, 'Seria A spółki PSA\n— 1 (A)\n— 2 (A)');
});

test('docx: nieznana sekcja trafia na listę braków i nie wypuszcza pustego bloku', () => {
  const plik = dokument(akapit('{{#przeszkody}}'), akapit('{{przeszkoda_opis}}'), akapit('{{/przeszkody}}'));
  const { tekst, brakujace } = wypelnijNaTekst(plik, {});
  assert.equal(tekst, '');
  assert.deepEqual(brakujace, ['przeszkody (sekcja)']);
});

test('docx: niezamknięta sekcja jest zgłaszana jako błąd, a reszta pisma nadal się wypełnia', () => {
  const { tekst, bledy } = wypelnijNaTekst(dokument(akapit('{{#zalaczniki}}'), akapit('Znak: {{sprawa_numer}}')), {
    sprawa_numer: 'RA/2026/0042',
  });
  assert.equal(bledy.length, 1);
  assert.match(bledy[0], /nie została zamknięta/);
  assert.match(tekst, /RA\/2026\/0042/);
});

test('docx: treść w akapicie ze znacznikiem sekcji jest sygnalizowana ostrzeżeniem', () => {
  const plik = dokument(akapit('{{#zalaczniki}} Wykaz:'), akapit('{{zalacznik_nazwa}}'), akapit('{{/zalaczniki}}'));
  const { ostrzezenia } = wypelnijNaTekst(plik, { zalaczniki: [{ zalacznik_nazwa: 'umowa' }] });
  assert.equal(ostrzezenia.length, 1);
  assert.match(ostrzezenia[0], /ten akapit znika w całości/);
});

// ─────────────────────────────────────────────────────────────
// Rozbite placeholdery
// ─────────────────────────────────────────────────────────────

test('docx: pole rozbite przez Worda na kilka przebiegów zostaje scalone i podstawione', () => {
  const plik = dokument(akapit('Spółka {{spolka_', 'firma}}', ' z siedzibą'));
  const { tekst, brakujace, ostrzezenia } = wypelnijNaTekst(plik, { spolka_firma: 'PSA' });
  assert.equal(tekst, 'Spółka PSA z siedzibą');
  assert.deepEqual(brakujace, []);
  assert.equal(ostrzezenia.length, 1);
  assert.match(ostrzezenia[0], /było rozbite/);
});

test('docx: scalanie nie rusza akapitów bez pól', () => {
  const plik = dokument(akapit('Zwykły ', 'tekst ', 'w trzech przebiegach.'));
  const { tekst, ostrzezenia } = wypelnijNaTekst(plik, {});
  assert.equal(tekst, 'Zwykły tekst w trzech przebiegach.');
  assert.deepEqual(ostrzezenia, []);
});

// ─────────────────────────────────────────────────────────────
// Prawdziwe wzory z katalogu `wzory/`
// ─────────────────────────────────────────────────────────────

const WZORY = fs.existsSync(KATALOG_WZOROW)
  ? fs.readdirSync(KATALOG_WZOROW).filter((n) => n.toLowerCase().endsWith('.docx')).sort()
  : [];

test('wzory: katalog zawiera pliki .docx do sprawdzenia', () => {
  assert.ok(WZORY.length > 0, 'brak wzorów w katalogu wzory/ — testy niżej nic by nie sprawdziły');
});

for (const nazwa of WZORY) {
  test(`wzór ${nazwa}: da się odczytać, a pola i sekcje są domknięte`, () => {
    const { proste, sekcje, niezamkniete, ostrzezenia } = docx.kluczeWzoru(
      fs.readFileSync(path.join(KATALOG_WZOROW, nazwa))
    );
    assert.deepEqual(niezamkniete, [], `sekcje bez znacznika zamykającego: ${niezamkniete.join(', ')}`);
    assert.deepEqual(ostrzezenia, [], `rozbite pola we wzorze: ${ostrzezenia.join(' | ')}`);
    assert.ok(proste.length > 0, 'wzór nie ma ani jednego pola do podstawienia');
    for (const klucz of [...proste, ...sekcje]) {
      assert.match(klucz, /^[a-z][a-z0-9_]*$/, `klucz „${klucz}" łamie konwencję nazw ze słownika`);
    }
  });

  test(`wzór ${nazwa}: wypełniony plik jest poprawnym .docx bez resztek pól`, () => {
    const zrodlo = fs.readFileSync(path.join(KATALOG_WZOROW, nazwa));
    const { proste, sekcje } = docx.kluczeWzoru(zrodlo);
    // Każdy klucz dostaje wartość rozpoznawalną w wyniku, każda sekcja — dwie
    // pozycje, żeby powielanie miało co powtórzyć.
    const dane = {};
    for (const klucz of proste) dane[klucz] = `«${klucz}»`;
    for (const nazwaSekcji of sekcje) {
      dane[nazwaSekcji] = [{}, {}].map(() => {
        const pozycja = {};
        for (const klucz of proste) pozycja[klucz] = `«${klucz}»`;
        return pozycja;
      });
    }
    const wynik = docx.wypelnij(zrodlo, dane);
    assert.deepEqual(wynik.bledy, []);
    assert.deepEqual(wynik.brakujace, []);

    const tekst = docx.tekst(wynik.plik);
    assert.ok(!tekst.includes('{{'), 'w wypełnionym piśmie zostały niepodstawione pola');
    assert.ok(!tekst.includes('}}'), 'w wypełnionym piśmie zostały resztki znaczników');
    // Kontener musi dać się odczytać z powrotem w komplecie — to jest test na
    // poprawność zapisu ZIP-a, a nie na samo podstawianie.
    const czesciWzoru = zip.rozpakujWszystko(zrodlo);
    const czesciWyniku = zip.rozpakujWszystko(wynik.plik);
    assert.deepEqual([...czesciWyniku.keys()], [...czesciWzoru.keys()]);
    for (const [czesc, tresc] of czesciWzoru) {
      if (czesc === 'word/document.xml') continue;
      assert.deepEqual(czesciWyniku.get(czesc), tresc, `część „${czesc}" zmieniła się mimo braku powodu`);
    }
  });
}
