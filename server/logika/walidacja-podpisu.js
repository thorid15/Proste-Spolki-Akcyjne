'use strict';

/**
 * Podstawowy test pliku po wgraniu (W2.4; DECYZJE.md D-086 — zastępuje D-075 w części walidacji).
 *
 * System sprawdza tylko dwie rzeczy:
 *   1. czy plik jest podpisany elektronicznie — skan, zdjęcie, niepodpisany PDF,
 *      inny plik → ODRZUCONY (komunikat dla klienta);
 *   2. porównanie z oryginałem (W3.4) — PAdES: skrót początkowych bajtów o długości
 *      oryginału = skrót zapisany przy wystawieniu; XAdES: skrót osadzonego dokumentu;
 *      na pewno inny dokument → ODRZUCONY; nie da się porównać → bez blokady.
 * Plik, który przejdzie → DO WERYFIKACJI. Ważność podpisu, osobę podpisującą i formę
 * sprawdza PRACOWNIK kancelarii („Do zrobienia → podpisy”, D-052). Bez usług zewnętrznych.
 *
 * W trybie testowym (D-074) wynik może narzucić atrapa z panelu `/test`.
 */

const crypto = require('node:crypto');
const konfiguracja = require('../konfiguracja');

const WYNIKI = { DO_WERYFIKACJI: 'do_weryfikacji', ODRZUCONY: 'odrzucony' };

const KOMUNIKATY = {
  brak: 'Ten plik nie ma podpisu elektronicznego — wygląda na skan, zdjęcie albo niepodpisany PDF. '
    + 'Skanu nie przyjmujemy. Podpisz pobrany dokument w mObywatelu (podpis kwalifikowany), profilem zaufanym '
    + 'na gov.pl (wgraj wtedy plik .xml) albo podpisem osobistym — albo podpisz na papierze: oryginał pocztą '
    + '(także z podpisem notarialnie poświadczonym) lub w kancelarii.',
  zmieniony: 'Ten plik różni się od dokumentu pobranego z portalu — najpewniej został otwarty i zapisany '
    + 'ponownie w innym programie. Pobierz dokument jeszcze raz i podpisz go bez otwierania w innych programach.',
  przyjety: 'Plik ma podpis elektroniczny — pracownik kancelarii sprawdzi podpis i dokument.',
};

function sha256(bufor) {
  return crypto.createHash('sha256').update(bufor).digest('hex');
}

/** OID signedData (1.2.840.113549.1.7.2) w kodowaniu DER — rdzeń CAdES / PKCS#7. */
const OID_SIGNED_DATA = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);

/** Rodzaj pliku po treści, nie po rozszerzeniu. */
function format(plik) {
  if (plik.length >= 4 && plik.slice(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (plik.length >= 3 && plik[0] === 0xff && plik[1] === 0xd8 && plik[2] === 0xff) return 'obraz';
  if (plik.length >= 8 && plik.slice(1, 4).toString('latin1') === 'PNG') return 'obraz';
  if (plik.length >= 2 && plik[0] === 0x30 && plik.indexOf(OID_SIGNED_DATA) !== -1) return 'cades';
  const poczatek = plik.slice(0, 512).toString('utf8').trimStart();
  if (poczatek.startsWith('<?xml') || poczatek.startsWith('<')) {
    return /<(?:\w+:)?Signature\b/.test(plik.toString('utf8')) ? 'xades' : 'xml';
  }
  return 'inny';
}

/** PDF jest podpisany, gdy ma słownik podpisu z `/ByteRange` (wyszukiwanie bajtów, nie parsowanie PDF). */
function pdfMaPodpis(plik) {
  const tekst = plik.toString('latin1');
  return /\/ByteRange\s*\[/.test(tekst) && /\/Type\s*\/Sig\b|\/FT\s*\/Sig\b|\/SubFilter\s*\//.test(tekst);
}

/**
 * XAdES otaczający (np. podpis zaufany z gov.pl): dokument osadzony w `ds:Object` (base64).
 * Obiektów bywa kilka (np. `xades:QualifyingProperties`) — bierzemy pierwszy z czystym base64.
 */
function dokumentZXades(plik) {
  const wzor = /<(?:\w+:)?Object\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Object>/g;
  for (const m of plik.toString('utf8').matchAll(wzor)) {
    const tresc = m[1].replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(tresc) && tresc.length >= 8) return Buffer.from(tresc, 'base64');
  }
  return null;
}

/** W3.4 — `{ zgodny: true|false|null, opis }` (null = nie da się porównać → bez blokady). */
function sprawdzOryginal(plik, rodzaj, oryginal) {
  if (!oryginal || !oryginal.sha256 || !oryginal.dlugosc) return { zgodny: null, opis: 'brak zapisanego skrótu oryginału' };
  if (rodzaj === 'pdf') {
    if (plik.length < oryginal.dlugosc) return { zgodny: false, opis: 'plik krótszy niż oryginał' };
    const zgodny = sha256(plik.slice(0, oryginal.dlugosc)) === oryginal.sha256;
    return { zgodny, opis: zgodny ? 'pierwsza wersja = oryginał' : 'początek pliku różni się od oryginału' };
  }
  if (rodzaj === 'xades') {
    const osadzony = dokumentZXades(plik);
    if (!osadzony) return { zgodny: null, opis: 'XAdES bez osadzonego dokumentu — porównaj ręcznie' };
    const zgodny = sha256(osadzony) === oryginal.sha256;
    return { zgodny, opis: zgodny ? 'podpisany dokument = oryginał' : 'podpisany dokument różni się od oryginału' };
  }
  return { zgodny: null, opis: 'format bez możliwości porównania — porównaj ręcznie' };
}

function zAtrapy(wybor) {
  if (wybor === 'brak_podpisu') {
    return { wynik: WYNIKI.ODRZUCONY, typ: null, komunikat: KOMUNIKATY.brak, kontrole: ['atrapa: brak podpisu'], atrapa: true };
  }
  if (wybor === 'zmieniony') {
    return { wynik: WYNIKI.ODRZUCONY, typ: 'atrapa', komunikat: KOMUNIKATY.zmieniony, kontrole: ['atrapa: plik różny od oryginału'], atrapa: true };
  }
  return { wynik: WYNIKI.DO_WERYFIKACJI, typ: 'atrapa', komunikat: KOMUNIKATY.przyjety, kontrole: ['atrapa: plik podpisany'], atrapa: true };
}

/**
 * @param {object} p
 * @param {Buffer} p.plik
 * @param {{sha256:string, dlugosc:number}|null} [p.oryginal] — skrót i długość dokumentu wystawionego przez kancelarię
 * @param {() => string} [p.atrapa] — tryb testowy: 'podpisany' | 'brak_podpisu' | 'zmieniony' | 'plik' (test jak na produkcji)
 * @returns {Promise<{wynik, typ, komunikat, kontrole: string[], atrapa?: boolean}>}
 */
async function waliduj({ plik, oryginal = null, atrapa = null }) {
  if (konfiguracja.TRYB_TESTOWY && atrapa) {
    const wybor = atrapa();
    if (wybor !== 'plik') return zAtrapy(wybor);
  }
  const rodzaj = format(plik);
  const podpisany = rodzaj === 'xades' || rodzaj === 'cades' || (rodzaj === 'pdf' && pdfMaPodpis(plik));
  const kontrole = [`format: ${rodzaj}`, podpisany ? 'podpis elektroniczny: jest' : 'podpis elektroniczny: brak'];
  if (!podpisany) return { wynik: WYNIKI.ODRZUCONY, typ: null, komunikat: KOMUNIKATY.brak, kontrole };
  const typ = rodzaj === 'pdf' ? 'pades' : rodzaj;
  const zgodnosc = sprawdzOryginal(plik, rodzaj, oryginal);
  kontrole.push(`oryginał: ${zgodnosc.opis}`);
  if (zgodnosc.zgodny === false) return { wynik: WYNIKI.ODRZUCONY, typ, komunikat: KOMUNIKATY.zmieniony, kontrole };
  return { wynik: WYNIKI.DO_WERYFIKACJI, typ, komunikat: KOMUNIKATY.przyjety, kontrole };
}

module.exports = { WYNIKI, waliduj, format, sprawdzOryginal };
