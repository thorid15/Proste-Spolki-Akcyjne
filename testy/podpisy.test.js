'use strict';

/**
 * Podstawowy test pliku po wgraniu (D-086):
 * system sprawdza tylko, czy plik JEST podpisany — resztę sprawdza pracownik.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const walidacja = require('../server/logika/walidacja-podpisu');

const ORYGINAL = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
const SLOWNIK_PODPISU = '\n9 0 obj << /Type /Sig /SubFilter /ETSI.CAdES.detached /ByteRange [0 1 2 3] /Contents <00> >> endobj\n%%EOF\n';
const PODPISANY = Buffer.concat([ORYGINAL, Buffer.from(SLOWNIK_PODPISU)]);
const odcisk = { sha256: require('node:crypto').createHash('sha256').update(ORYGINAL).digest('hex'), dlugosc: ORYGINAL.length };

test('W2.4: skan (JPG/PNG), PDF bez podpisu, zwykły XML i inny plik — odrzucone z komunikatem dla laika', async () => {
  const pliki = [
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1]),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ORYGINAL,
    Buffer.from('<?xml version="1.0"?><dokument>bez podpisu</dokument>'),
    Buffer.from('zwykły tekst'),
  ];
  for (const plik of pliki) {
    const w = await walidacja.waliduj({ plik });
    assert.equal(w.wynik, 'odrzucony');
    assert.match(w.komunikat, /Skanu nie przyjmujemy/);
  }
});

test('D-086: plik podpisany (PAdES, XAdES, CAdES) → do weryfikacji przez pracownika, bez dalszych kontroli', async () => {
  const xades = Buffer.from('<?xml version="1.0"?><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo/></ds:Signature>');
  const cades = Buffer.concat([Buffer.from([0x30, 0x80]), Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]), Buffer.alloc(16)]);
  for (const [plik, typ] of [[PODPISANY, 'pades'], [xades, 'xades'], [cades, 'cades']]) {
    const w = await walidacja.waliduj({ plik });
    assert.equal(w.wynik, 'do_weryfikacji', typ);
    assert.equal(w.typ, typ);
  }
});

test('D-087: podpis zaufany z gov.pl (XAdES .xml) — przyjęty; dokument osadzony porównany, także za QualifyingProperties', async () => {
  const pz = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">'
    + '<ds:SignedInfo/><ds:Object><xades:QualifyingProperties xmlns:xades="x"><xades:SignedProperties/></xades:QualifyingProperties></ds:Object>'
    + `<ds:Object Id="dok" MimeType="application/pdf" Encoding="http://www.w3.org/2000/09/xmldsig#base64">${ORYGINAL.toString('base64')}</ds:Object></ds:Signature>`);
  const w = await walidacja.waliduj({ plik: pz, oryginal: odcisk });
  assert.equal(w.wynik, 'do_weryfikacji');
  assert.equal(w.typ, 'xades');
  assert.match(w.kontrole.join(' '), /podpisany dokument = oryginał/);
  const brak = await walidacja.waliduj({ plik: ORYGINAL });
  assert.match(brak.komunikat, /profilem zaufanym/);
  assert.match(brak.komunikat, /oryginał pocztą/);
});

test('W3.4: porównanie z oryginałem — zgodny przechodzi, zmieniony odrzucony, bez skrótu bez blokady', async () => {
  assert.equal((await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk })).wynik, 'do_weryfikacji');
  const zmieniony = Buffer.concat([Buffer.from('%PDF-1.7\n2'), PODPISANY.slice(10)]);
  const w = await walidacja.waliduj({ plik: zmieniony, oryginal: odcisk });
  assert.equal(w.wynik, 'odrzucony');
  assert.match(w.komunikat, /różni się od dokumentu pobranego/);
  assert.equal((await walidacja.waliduj({ plik: zmieniony })).wynik, 'do_weryfikacji', 'brak skrótu oryginału — sprawdza pracownik');
  const xades = Buffer.from(`<?xml version="1.0"?><ds:Signature xmlns:ds="x"><ds:Object>${ORYGINAL.toString('base64')}</ds:Object></ds:Signature>`);
  assert.equal(walidacja.sprawdzOryginal(xades, 'xades', odcisk).zgodny, true);
  const xadesInny = Buffer.from(`<ds:Signature><ds:Object>${Buffer.from('inny').toString('base64')}AAAA</ds:Object></ds:Signature>`);
  assert.equal(walidacja.sprawdzOryginal(xadesInny, 'xades', odcisk).zgodny, false);
});

test('próbki prawdziwych podpisów (testy/fixtures/podpisy, tylko lokalnie) — rozpoznane jako podpisane', async (t) => {
  const katalog = path.join(__dirname, 'fixtures', 'podpisy');
  const probki = fs.existsSync(katalog) ? fs.readdirSync(katalog).filter((n) => /__(qes|pz|po)\.(pdf|xml|xades|p7s|sig)$/.test(n)) : [];
  if (probki.length === 0) {
    t.skip('Brak próbek w testy/fixtures/podpisy (pliki z danymi osobowymi trzymamy tylko lokalnie).');
    return;
  }
  for (const nazwa of probki) {
    await t.test(nazwa, async () => {
      const plik = fs.readFileSync(path.join(katalog, nazwa));
      assert.equal((await walidacja.waliduj({ plik })).wynik, 'do_weryfikacji');
      const sciezkaOryginalu = path.join(katalog, `${nazwa.split('__')[0]}__oryginal.pdf`);
      if (fs.existsSync(sciezkaOryginalu)) {
        const o = fs.readFileSync(sciezkaOryginalu);
        assert.equal((await walidacja.waliduj({ plik: o })).wynik, 'odrzucony', 'oryginał bez podpisu');
        const odc = { sha256: require('node:crypto').createHash('sha256').update(o).digest('hex'), dlugosc: o.length };
        assert.equal(walidacja.sprawdzOryginal(plik, 'pdf', odc).zgodny, true, 'pierwsza wersja = oryginał');
        assert.equal((await walidacja.waliduj({ plik, oryginal: { ...odc, sha256: '0'.repeat(64) } })).wynik, 'odrzucony', 'inny oryginał');
      }
    });
  }
});
