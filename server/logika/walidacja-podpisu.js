'use strict';

/**
 * Walidacja podpisu po wgraniu pliku (W2.4, W3.3–W3.5; DECYZJE.md D-075).
 *
 * ZASADA: blokujemy tylko to, co NA PEWNO niespełnione; niepewne → „do
 * weryfikacji ręcznej”; nigdy automatycznej akceptacji bez udanej walidacji.
 * Wynik nie zaznacza checklisty (D-052) — trafia do „Do zrobienia”.
 *
 * Kolejność:
 *   1. format pliku — obraz (skan) albo PDF bez podpisu → ODRZUCONY;
 *   2. pierwsza wersja = oryginał (W3.4) — PAdES: skrót początkowych bajtów
 *      o długości oryginału = skrót zapisany przy generowaniu; XAdES: skrót
 *      podpisanego dokumentu osadzonego w XML; niezgodność → ODRZUCONY;
 *   3. usługa DSS (biblioteka Komisji Europejskiej, osobna usługa na
 *      serwerze, REST) — typ podpisu i dane podpisującego z jej raportu.
 *      Node nie dostaje żadnej biblioteki kryptograficznej ani PDF.
 *      DSS niedostępna / błąd / brak adresu → DO WERYFIKACJI;
 *   4. podpisujący = oczekiwana osoba (W3.5) — PESEL z `serialNumber`
 *      „PNOPL-…”; brak PESEL po którejkolwiek stronie → DO WERYFIKACJI;
 *      różne PESEL → ODRZUCONY.
 *
 * PZ i PO DSS najpewniej oznaczy jako niekwalifikowane — dopóki nie ustalimy
 * ich rozpoznania na próbkach, KAŻDY podpis niekwalifikowany idzie do
 * weryfikacji ręcznej (nie odrzucamy go jako „zaawansowany”).
 *
 * W trybie testowym (D-074) wynik daje atrapa z panelu `/test`.
 */

const crypto = require('node:crypto');
const konfiguracja = require('../konfiguracja');

const WYNIKI = { POPRAWNY: 'poprawny', DO_WERYFIKACJI: 'do_weryfikacji', ODRZUCONY: 'odrzucony' };

const KOMUNIKATY = {
  brak: 'Ten plik nie ma podpisu elektronicznego — wygląda na skan, zdjęcie albo niepodpisany PDF. '
    + 'Skanu nie przyjmujemy. Podpisz pobrany dokument w mObywatelu (podpis kwalifikowany), podpisem '
    + 'zaufanym albo osobistym i wgraj plik z podpisem — albo odeślij oryginał pocztą.',
  zmieniony: 'Ten plik różni się od dokumentu pobranego z portalu — najpewniej został otwarty i zapisany '
    + 'ponownie w innym programie. Pobierz dokument jeszcze raz i podpisz go bez otwierania w innych programach.',
  zaawansowany: 'Podpis w tym pliku nie jest podpisem kwalifikowanym, zaufanym ani osobistym. '
    + 'Podpisz dokument w mObywatelu, podpisem zaufanym albo osobistym.',
  niewazny: 'Podpis w tym pliku jest nieważny (weryfikacja wykazała uszkodzenie albo unieważniony certyfikat). '
    + 'Podpisz dokument ponownie.',
};

function sha256(bufor) {
  return crypto.createHash('sha256').update(bufor).digest('hex');
}

/** Rozpoznanie formatu po treści, nie po rozszerzeniu. */
function format(plik) {
  if (plik.length >= 4 && plik.slice(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (plik.length >= 3 && plik[0] === 0xff && plik[1] === 0xd8 && plik[2] === 0xff) return 'obraz';
  if (plik.length >= 8 && plik.slice(1, 4).toString('latin1') === 'PNG') return 'obraz';
  const poczatek = plik.slice(0, 512).toString('utf8').trimStart();
  if (poczatek.startsWith('<?xml') || poczatek.startsWith('<')) {
    return /Signature/i.test(plik.toString('utf8')) ? 'xades' : 'xml';
  }
  return 'inny';
}

/**
 * PDF ma podpis wtedy, gdy ma słownik podpisu z `/ByteRange` — bez niego na
 * pewno nie ma podpisu PAdES. To wyszukiwanie bajtów, nie parsowanie PDF.
 */
function pdfMaPodpis(plik) {
  const tekst = plik.toString('latin1');
  return /\/ByteRange\s*\[/.test(tekst) && /\/Type\s*\/Sig\b|\/FT\s*\/Sig\b|\/SubFilter\s*\//.test(tekst);
}

/** XAdES otaczający: dokument osadzony w `ds:Object` (base64). */
function dokumentZXades(plik) {
  const xml = plik.toString('utf8');
  const m = /<(?:\w+:)?Object\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Object>/.exec(xml);
  if (!m) return null;
  const tresc = m[1].replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(tresc) || tresc.length < 8) return null;
  return Buffer.from(tresc, 'base64');
}

/** W3.4 — `{ zgodny: true|false|null, opis }` (null = nie da się ustalić). */
function sprawdzOryginal(plik, rodzaj, oryginal) {
  if (!oryginal || !oryginal.sha256 || !oryginal.dlugosc) return { zgodny: null, opis: 'brak zapisanego skrótu oryginału' };
  if (rodzaj === 'pdf') {
    if (plik.length < oryginal.dlugosc) return { zgodny: false, opis: 'plik krótszy niż oryginał' };
    const zgodny = sha256(plik.slice(0, oryginal.dlugosc)) === oryginal.sha256;
    return { zgodny, opis: zgodny ? 'pierwsza wersja = oryginał (podpis przyrostowy)' : 'początek pliku różni się od oryginału' };
  }
  if (rodzaj === 'xades') {
    const osadzony = dokumentZXades(plik);
    if (!osadzony) return { zgodny: null, opis: 'XAdES bez osadzonego dokumentu (podpis zewnętrzny)' };
    const zgodny = sha256(osadzony) === oryginal.sha256;
    return { zgodny, opis: zgodny ? 'podpisany dokument = oryginał' : 'podpisany dokument różni się od oryginału' };
  }
  return { zgodny: null, opis: 'format bez możliwości porównania' };
}

// ─────────────────────────────────────────────────────────────
// Raport DSS → typ podpisu i podpisujący
// ─────────────────────────────────────────────────────────────

/** Wszystkie obiekty w drzewie, które mają klucz `klucz`. */
function znajdzObiekty(wezel, klucz, wynik = []) {
  if (!wezel || typeof wezel !== 'object') return wynik;
  if (Array.isArray(wezel)) {
    for (const w of wezel) znajdzObiekty(w, klucz, wynik);
    return wynik;
  }
  if (Object.prototype.hasOwnProperty.call(wezel, klucz)) wynik.push(wezel);
  for (const v of Object.values(wezel)) znajdzObiekty(v, klucz, wynik);
  return wynik;
}

function wartoscPola(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v.value ?? v.Value ?? null;
  return String(v);
}

/** Pole z DN w formacie RFC 2253 (`SERIALNUMBER=PNOPL-…,GIVENNAME=…`). */
function zDn(dn, nazwy) {
  if (!dn) return null;
  for (const czesc of String(dn).split(/,(?=\s*[A-Za-z0-9.]+=)/)) {
    const [k, ...v] = czesc.split('=');
    if (nazwy.includes(k.trim().toUpperCase())) return v.join('=').trim();
  }
  return null;
}

function peselZSerialNumber(serial) {
  const m = /PNOPL-(\d{11})/.exec(String(serial || ''));
  return m ? m[1] : null;
}

/**
 * Wyciąga z odpowiedzi DSS (`/services/rest/validation/validateSignature`)
 * wskazanie i poziom pierwszego podpisu oraz dane certyfikatu podpisującego.
 * Odporne na różnice wersji DSS (nazwy list w raportach się zmieniały).
 */
function zRaportuDss(raport) {
  const prosty = (raport && (raport.simpleReport || raport.SimpleReport)) || {};
  const podpisy = znajdzObiekty(prosty, 'Indication').filter((o) => o.SignatureLevel || o.SignatureFormat || o.SignedBy);
  if (podpisy.length === 0) return { podpisow: 0 };
  const p = podpisy[0];
  const poziom = wartoscPola(p.SignatureLevel);

  const diag = (raport && (raport.diagnosticData || raport.DiagnosticData)) || {};
  const certyfikaty = znajdzObiekty(diag, 'SubjectDistinguishedName');
  let idCert = null;
  const podpisDiag = znajdzObiekty(diag, 'SigningCertificate')[0];
  if (podpisDiag && podpisDiag.SigningCertificate) {
    const sc = podpisDiag.SigningCertificate;
    idCert = typeof sc.Certificate === 'string' ? sc.Certificate : (sc.Certificate && sc.Certificate.Id) || sc.Id || null;
  }
  const cert = certyfikaty.find((c) => idCert && c.Id === idCert)
    || certyfikaty.find((c) => c.GivenName || c.Surname || c.SubjectSerialNumber)
    || null;
  let dn = null;
  if (cert) {
    const dns = Array.isArray(cert.SubjectDistinguishedName) ? cert.SubjectDistinguishedName : [cert.SubjectDistinguishedName];
    const rfc = dns.find((d) => d && (d.Format === 'RFC2253' || d.format === 'RFC2253')) || dns[0];
    dn = rfc ? wartoscPola(rfc) : null;
  }
  const serial = cert ? (cert.SubjectSerialNumber || zDn(dn, ['SERIALNUMBER', '2.5.4.5'])) : null;
  return {
    podpisow: podpisy.length,
    wskazanie: p.Indication || null,
    podwskazanie: p.SubIndication || null,
    poziom,
    formatPodpisu: p.SignatureFormat || null,
    podpisujacy: {
      imie: cert ? (cert.GivenName || zDn(dn, ['GIVENNAME', 'GN', '2.5.4.42'])) : null,
      nazwisko: cert ? (cert.Surname || zDn(dn, ['SURNAME', 'SN', '2.5.4.4'])) : null,
      nazwa: p.SignedBy || (cert && (cert.CommonName || zDn(dn, ['CN']))) || null,
      pesel: peselZSerialNumber(serial),
    },
  };
}

async function zapytajDss(plik, nazwa) {
  const adres = `${String(konfiguracja.PODPIS.dss_url).replace(/\/$/, '')}/services/rest/validation/validateSignature`;
  const odp = await fetch(adres, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      signedDocument: { bytes: plik.toString('base64'), name: nazwa || 'dokument' },
      originalDocuments: [],
      policy: null,
      signatureId: null,
    }),
    signal: AbortSignal.timeout(konfiguracja.PODPIS.dss_limit_ms),
  });
  if (!odp.ok) throw new Error(`DSS odpowiedział ${odp.status}`);
  return odp.json();
}

// ─────────────────────────────────────────────────────────────
// Podpisujący = oczekiwana osoba (W3.5)
// ─────────────────────────────────────────────────────────────

function normalizuj(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toUpperCase().replace(/[^A-Z]/g, '');
}

function sprawdzPodpisujacego(podpisujacy, oczekiwany) {
  if (!oczekiwany) return { zgodny: null, opis: 'nie wskazano osoby, która ma podpisać' };
  const peselCert = podpisujacy && podpisujacy.pesel;
  const peselOcz = oczekiwany.pesel ? String(oczekiwany.pesel).trim() : null;
  if (peselCert && peselOcz) {
    if (peselCert !== peselOcz) return { zgodny: false, opis: 'PESEL w certyfikacie różni się od PESEL osoby, która ma podpisać' };
    const nazwiskoZgodne = !podpisujacy.nazwisko || normalizuj(podpisujacy.nazwisko) === normalizuj(oczekiwany.nazwisko);
    return nazwiskoZgodne
      ? { zgodny: true, opis: 'PESEL i nazwisko zgodne' }
      : { zgodny: null, opis: 'PESEL zgodny, nazwisko w certyfikacie inne — sprawdź ręcznie' };
  }
  return {
    zgodny: null,
    opis: peselCert ? 'brak PESEL osoby oczekiwanej — porównaj dane ręcznie' : 'certyfikat bez PESEL (PNOPL) — porównaj dane ręcznie',
  };
}

// ─────────────────────────────────────────────────────────────
// Atrapa (tryb testowy, T5)
// ─────────────────────────────────────────────────────────────

function zAtrapy(wybor, oczekiwany) {
  const osoba = oczekiwany ? { imie: oczekiwany.imie || null, nazwisko: oczekiwany.nazwisko || null, pesel: oczekiwany.pesel || null } : null;
  const baza = { atrapa: true, podpisujacy: osoba, kontrole: [`atrapa walidatora: ${wybor}`] };
  switch (wybor) {
    case 'qes_poprawny': return { ...baza, wynik: WYNIKI.POPRAWNY, typ: 'qes', komunikat: null };
    case 'pz': return { ...baza, wynik: WYNIKI.DO_WERYFIKACJI, typ: 'pz', komunikat: 'Podpis zaufany — rozpoznanie automatyczne jeszcze nieustalone, sprawdź ręcznie.' };
    case 'po': return { ...baza, wynik: WYNIKI.DO_WERYFIKACJI, typ: 'po', komunikat: 'Podpis osobisty — rozpoznanie automatyczne jeszcze nieustalone, sprawdź ręcznie.' };
    case 'zaawansowany': return { ...baza, wynik: WYNIKI.ODRZUCONY, typ: 'zaawansowany', komunikat: KOMUNIKATY.zaawansowany };
    case 'brak_podpisu': return { ...baza, wynik: WYNIKI.ODRZUCONY, typ: 'brak', podpisujacy: null, komunikat: KOMUNIKATY.brak };
    case 'plik_zmieniony': return { ...baza, wynik: WYNIKI.ODRZUCONY, typ: 'qes', komunikat: KOMUNIKATY.zmieniony };
    case 'inna_osoba': return {
      ...baza, wynik: WYNIKI.ODRZUCONY, typ: 'qes',
      podpisujacy: { imie: 'Inna', nazwisko: 'Osoba', pesel: '00000000000' },
      komunikat: `Dokument podpisała inna osoba niż ${oczekiwany ? `${oczekiwany.imie || ''} ${oczekiwany.nazwisko || ''}`.trim() : 'oczekiwana'}.`,
    };
    default: return { ...baza, wynik: WYNIKI.DO_WERYFIKACJI, typ: null, komunikat: 'Nieznany wynik atrapy.' };
  }
}

// ─────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {Buffer} p.plik
 * @param {string} [p.nazwa]
 * @param {{sha256:string, dlugosc:number}|null} [p.oryginal]
 * @param {{imie?:string, nazwisko?:string, pesel?:string}|null} [p.oczekiwany]
 * @param {() => string} [p.atrapa] — w trybie testowym: wybrany wynik atrapy
 * @returns {Promise<{wynik, typ, podpisujacy, komunikat, kontrole: string[], atrapa?: boolean}>}
 */
async function waliduj({ plik, nazwa, oryginal = null, oczekiwany = null, atrapa = null }) {
  if (konfiguracja.TRYB_TESTOWY && atrapa) return zAtrapy(atrapa(), oczekiwany);

  const kontrole = [];
  const rodzaj = format(plik);
  kontrole.push(`format: ${rodzaj}`);

  if (rodzaj === 'obraz' || rodzaj === 'inny' || rodzaj === 'xml' || (rodzaj === 'pdf' && !pdfMaPodpis(plik))) {
    return { wynik: WYNIKI.ODRZUCONY, typ: 'brak', podpisujacy: null, komunikat: KOMUNIKATY.brak, kontrole };
  }

  const zgodnosc = sprawdzOryginal(plik, rodzaj, oryginal);
  kontrole.push(`oryginał: ${zgodnosc.opis}`);
  if (zgodnosc.zgodny === false) {
    return { wynik: WYNIKI.ODRZUCONY, typ: null, podpisujacy: null, komunikat: KOMUNIKATY.zmieniony, kontrole };
  }

  if (!konfiguracja.PODPIS.dss_url) {
    kontrole.push('DSS: brak adresu usługi (DSS_URL) — weryfikacja ręczna');
    return { wynik: WYNIKI.DO_WERYFIKACJI, typ: null, podpisujacy: null, komunikat: 'Usługa walidacji podpisu nie jest skonfigurowana — sprawdź podpis ręcznie.', kontrole };
  }

  let dss;
  try {
    dss = zRaportuDss(await zapytajDss(plik, nazwa));
  } catch (e) {
    kontrole.push(`DSS: ${e.message}`);
    return { wynik: WYNIKI.DO_WERYFIKACJI, typ: null, podpisujacy: null, komunikat: 'Usługa walidacji podpisu nie odpowiedziała — sprawdź podpis ręcznie.', kontrole };
  }
  kontrole.push(`DSS: ${dss.podpisow} podpis(y), ${dss.wskazanie || '—'} / ${dss.poziom || '—'}`);

  if (!dss.podpisow) {
    // DSS nie widzi podpisu, choć plik ma słownik podpisu — niepewne.
    return { wynik: WYNIKI.DO_WERYFIKACJI, typ: null, podpisujacy: null, komunikat: 'Walidator nie odczytał podpisu — sprawdź ręcznie.', kontrole };
  }
  if (dss.wskazanie === 'TOTAL_FAILED') {
    return { wynik: WYNIKI.ODRZUCONY, typ: null, podpisujacy: dss.podpisujacy, komunikat: KOMUNIKATY.niewazny, kontrole };
  }
  const kwalifikowany = /^QES/i.test(String(dss.poziom || ''));
  if (!kwalifikowany) {
    return {
      wynik: WYNIKI.DO_WERYFIKACJI, typ: 'niekwalifikowany', podpisujacy: dss.podpisujacy,
      komunikat: 'Podpis niekwalifikowany — może to być podpis zaufany albo osobisty. Sprawdź ręcznie.', kontrole,
    };
  }

  const osoba = sprawdzPodpisujacego(dss.podpisujacy, oczekiwany);
  kontrole.push(`podpisujący: ${osoba.opis}`);
  if (osoba.zgodny === false) {
    return { wynik: WYNIKI.ODRZUCONY, typ: 'qes', podpisujacy: dss.podpisujacy, komunikat: 'Dokument podpisała inna osoba niż ta, która ma go podpisać.', kontrole };
  }
  if (dss.wskazanie !== 'TOTAL_PASSED' || zgodnosc.zgodny !== true || osoba.zgodny !== true) {
    return {
      wynik: WYNIKI.DO_WERYFIKACJI, typ: 'qes', podpisujacy: dss.podpisujacy,
      komunikat: dss.wskazanie !== 'TOTAL_PASSED'
        ? `Walidator zgłosił ostrzeżenie (${dss.wskazanie}${dss.podwskazanie ? ` / ${dss.podwskazanie}` : ''}) — sprawdź ręcznie.`
        : 'Podpis kwalifikowany ważny — potwierdź ręcznie zgodność dokumentu lub osoby.',
      kontrole,
    };
  }
  return { wynik: WYNIKI.POPRAWNY, typ: 'qes', podpisujacy: dss.podpisujacy, komunikat: null, kontrole };
}

module.exports = {
  WYNIKI,
  KOMUNIKATY,
  waliduj,
  format,
  pdfMaPodpis,
  sprawdzOryginal,
  zRaportuDss,
  sprawdzPodpisujacego,
  peselZSerialNumber,
};
