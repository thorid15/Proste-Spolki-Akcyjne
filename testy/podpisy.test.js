'use strict';

/**
 * Faza 2 (D-075, D-076): formy podpisu w jednym miejscu i walidacja podpisu.
 * Usługa DSS zastąpiona lokalną atrapą HTTP (kształt odpowiedzi REST DSS).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const konfiguracja = require('../server/konfiguracja');
const formy = require('../server/logika/formy-podpisu');
const walidacja = require('../server/logika/walidacja-podpisu');

const ORYGINAL = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
const SLOWNIK_PODPISU = '\n9 0 obj << /Type /Sig /SubFilter /ETSI.CAdES.detached /ByteRange [0 1 2 3] /Contents <00> >> endobj\n%%EOF\n';
const PODPISANY = Buffer.concat([ORYGINAL, Buffer.from(SLOWNIK_PODPISU)]);
const odcisk = { sha256: crypto.createHash('sha256').update(ORYGINAL).digest('hex'), dlugosc: ORYGINAL.length };
const ANNA = { imie: 'Anna', nazwisko: 'Testowa', pesel: '85031502488' };

/** Raport DSS w kształcie `validateSignature` (simpleReport + diagnosticData). */
function raportDss({ wskazanie = 'TOTAL_PASSED', poziom = 'QESig', pesel = ANNA.pesel, nazwisko = 'TESTOWA' } = {}) {
  return {
    simpleReport: {
      signatureOrTimestampOrEvidenceRecord: [{
        Signature: { Id: 'S-1', Indication: wskazanie, SignatureLevel: { value: poziom }, SignedBy: `ANNA ${nazwisko}`, SignatureFormat: 'PAdES-BASELINE-B' },
      }],
    },
    diagnosticData: {
      Signature: [{ Id: 'S-1', SigningCertificate: { Certificate: 'C-1' } }],
      UsedCertificate: [{
        Id: 'C-1',
        SubjectDistinguishedName: [{ Format: 'RFC2253', value: `SERIALNUMBER=PNOPL-${pesel},GIVENNAME=ANNA,SURNAME=${nazwisko},CN=ANNA ${nazwisko},C=PL` }],
      }],
    },
  };
}

let serwerDss;
let odpowiedzDss = raportDss();
test.before(async () => {
  serwerDss = http.createServer((zad, odp) => {
    let c = '';
    zad.on('data', (x) => { c += x; });
    zad.on('end', () => {
      if (zad.url !== '/services/rest/validation/validateSignature') { odp.writeHead(404); return odp.end(); }
      if (odpowiedzDss === 500) { odp.writeHead(500); return odp.end(); }
      odp.writeHead(200, { 'Content-Type': 'application/json' });
      odp.end(JSON.stringify(odpowiedzDss));
    });
  }).listen(0);
  await new Promise((r) => serwerDss.once('listening', r));
});
test.after(() => serwerDss.close());

function zDss(fn) {
  return async () => {
    const przed = konfiguracja.PODPIS.dss_url;
    konfiguracja.PODPIS.dss_url = `http://127.0.0.1:${serwerDss.address().port}`;
    try { await fn(); } finally { konfiguracja.PODPIS.dss_url = przed; odpowiedzDss = raportDss(); }
  };
}

test('W2.1/W2.2: formy z tabeli § 2 — skan nigdy, zgoda na wpis bez zwykłego oryginału', () => {
  for (const typ of Object.values(formy.DOKUMENTY)) {
    assert.equal(formy.ocenForme(typ, 'skan').dopuszczalna, false, typ);
    assert.equal(formy.ocenForme(typ, 'zaawansowany').dopuszczalna, false, typ);
  }
  const zgoda = formy.DOKUMENTY.ZGODA_NA_WPIS;
  for (const f of ['qes', 'pz', 'po', 'oryginal_poswiadczony', 'w_kancelarii']) assert.equal(formy.ocenForme(zgoda, f).dopuszczalna, true, f);
  assert.equal(formy.ocenForme(zgoda, 'oryginal').dopuszczalna, false, 'zwykły oryginał pocztą = brak zgody');
  assert.match(formy.ocenForme(zgoda, 'oryginal').przyczyna, /art\. 300\(34\) § 3 zd\. 2/);
  assert.equal(formy.ocenForme(formy.DOKUMENTY.UMOWA_ZBYCIA, 'oryginal').dopuszczalna, true);
  assert.equal(formy.ocenForme(formy.DOKUMENTY.UMOWA_REJESTRU, 'pz').dopuszczalna, true, 'zarząd: PZ');
  assert.equal(formy.ocenForme(formy.DOKUMENTY.UMOWA_REJESTRU, 'pz', { notariusz: true }).dopuszczalna, false, 'notariusz: tylko QES');
});

test('W2.4: obraz (skan) i PDF bez podpisu — odrzucone z komunikatem dla laika', async () => {
  const jpg = await walidacja.waliduj({ plik: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1]), oryginal: odcisk });
  assert.equal(jpg.wynik, 'odrzucony');
  assert.match(jpg.komunikat, /skan/);
  const pdf = await walidacja.waliduj({ plik: ORYGINAL, oryginal: odcisk });
  assert.equal(pdf.wynik, 'odrzucony');
  assert.equal(pdf.typ, 'brak');
});

test('W3.4: plik zmieniony po pobraniu (inny początek) — odrzucony; XAdES z osadzonym oryginałem porównywany', async () => {
  const zmieniony = Buffer.concat([Buffer.from('%PDF-1.7\n2'), PODPISANY.slice(10)]);
  const w = await walidacja.waliduj({ plik: zmieniony, oryginal: odcisk });
  assert.equal(w.wynik, 'odrzucony');
  assert.match(w.komunikat, /różni się od dokumentu pobranego/);
  const xades = Buffer.from(`<?xml version="1.0"?><ds:Signature xmlns:ds="x"><ds:Object>${ORYGINAL.toString('base64')}</ds:Object></ds:Signature>`);
  assert.equal(walidacja.sprawdzOryginal(xades, 'xades', odcisk).zgodny, true);
  const xadesInny = Buffer.from(`<ds:Signature><ds:Object>${Buffer.from('inny').toString('base64')}AAAA</ds:Object></ds:Signature>`);
  assert.equal(walidacja.sprawdzOryginal(xadesInny, 'xades', odcisk).zgodny, false);
});

test('bez usługi DSS — zawsze weryfikacja ręczna, nigdy automatyczna akceptacja', async () => {
  const w = await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: ANNA });
  assert.equal(w.wynik, 'do_weryfikacji');
});

test('W3.3/W3.5: DSS — QES TOTAL_PASSED, oryginał i PESEL zgodne → poprawny', zDss(async () => {
  const w = await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: ANNA });
  assert.equal(w.wynik, 'poprawny');
  assert.equal(w.typ, 'qes');
  assert.equal(w.podpisujacy.pesel, ANNA.pesel);
}));

test('W3.5: inny PESEL w certyfikacie → odrzucony; brak PESEL osoby → weryfikacja ręczna', zDss(async () => {
  odpowiedzDss = raportDss({ pesel: '90010112345' });
  assert.equal((await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: ANNA })).wynik, 'odrzucony');
  odpowiedzDss = raportDss();
  assert.equal((await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: { ...ANNA, pesel: null } })).wynik, 'do_weryfikacji');
}));

test('PZ/PO (poziom niekwalifikowany) nie są odrzucane jako zaawansowane; INDETERMINATE i awaria DSS → ręcznie', zDss(async () => {
  odpowiedzDss = raportDss({ poziom: 'AdESig' });
  const nk = await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: ANNA });
  assert.equal(nk.wynik, 'do_weryfikacji');
  odpowiedzDss = raportDss({ wskazanie: 'INDETERMINATE' });
  assert.equal((await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: ANNA })).wynik, 'do_weryfikacji');
  odpowiedzDss = raportDss({ wskazanie: 'TOTAL_FAILED' });
  assert.equal((await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: ANNA })).wynik, 'odrzucony');
  odpowiedzDss = 500;
  assert.equal((await walidacja.waliduj({ plik: PODPISANY, oryginal: odcisk, oczekiwany: ANNA })).wynik, 'do_weryfikacji');
}));

test('próbki prawdziwych podpisów (testy/fixtures/podpisy) — parametryzowane po plikach', async (t) => {
  const katalog = path.join(__dirname, 'fixtures', 'podpisy');
  const probki = fs.existsSync(katalog) ? fs.readdirSync(katalog).filter((n) => /__(qes|pz|po)\.(pdf|xml)$/.test(n)) : [];
  if (probki.length === 0) {
    t.skip('Brak próbek w testy/fixtures/podpisy — Łukasz dostarczy 4 dostawców mObywatela, PZ i PO (README w katalogu).');
    return;
  }
  for (const nazwa of probki) {
    await t.test(nazwa, async () => {
      const plik = fs.readFileSync(path.join(katalog, nazwa));
      const [dostawca] = nazwa.split('__');
      const plikOryginalu = path.join(katalog, `${dostawca}__oryginal.pdf`);
      const oryginal = fs.existsSync(plikOryginalu)
        ? (() => { const o = fs.readFileSync(plikOryginalu); return { sha256: crypto.createHash('sha256').update(o).digest('hex'), dlugosc: o.length }; })()
        : null;
      const w = await walidacja.waliduj({ plik, nazwa, oryginal });
      assert.notEqual(w.typ, 'brak', 'podpis rozpoznany');
      if (oryginal) assert.ok(!/różni się/.test(w.komunikat || ''), `${dostawca}: pierwsza rewizja = oryginał`);
    });
  }
});
