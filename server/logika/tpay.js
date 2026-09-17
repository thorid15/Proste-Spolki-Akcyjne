'use strict';

/**
 * Klient platnosci tpay — Open API.
 *
 * Trzy rzeczy, ktore ten plik robi, i nic wiecej:
 *   1. zdobywa i trzyma token OAuth (w pamieci procesu, nie w bazie),
 *   2. zaklada transakcje i oddaje link do zaplaty,
 *   3. sprawdza AUTENTYCZNOSC powiadomienia (ITN) i jego tresc.
 *
 * Czego tu NIE MA i byc nie powinno: zadnego dostepu do bazy, zadnej wiedzy
 * o oplatach i spolkach. Ten modul zna pieniadze i protokol; co znaczy
 * zaplacona oplata, wie `server/platnosci.js`.
 *
 * REGULA NADRZEDNA: powrot klienta na strone NIE JEST dowodem zaplaty.
 * Jedynym zrodlem prawdy o zaplacie jest powiadomienie ITN, sprawdzone
 * `sprawdzPodpisItn` — i nic poza nim.
 */

const crypto = require('node:crypto');

const konfiguracja = require('../konfiguracja');

/** Token zyje w pamieci procesu. Restart = nowy token, i dobrze. */
let token = null;
let tokenWazneDo = 0;

function skonfigurowany() {
  const t = konfiguracja.TPAY;
  return Boolean(t.client_id && t.client_secret);
}

class BladTpay extends Error {
  constructor(komunikat, status) {
    super(komunikat);
    this.name = 'BladTpay';
    this.status = status ?? null;
  }
}

async function zadanie(sciezka, { metoda = 'GET', cialo, zToken = true, ponowione = false, formularz = false } = {}) {
  const naglowki = {
    'Content-Type': formularz ? 'application/x-www-form-urlencoded' : 'application/json',
    Accept: 'application/json',
  };
  if (zToken) naglowki.Authorization = `Bearer ${await pobierzToken()}`;

  const odp = await fetch(`${konfiguracja.TPAY.api_url}${sciezka}`, {
    method: metoda,
    headers: naglowki,
    body: cialo === undefined
      ? undefined
      : (formularz ? new URLSearchParams(cialo).toString() : JSON.stringify(cialo)),
  });

  // Token wygasl wczesniej, niz obiecywal — jedno ponowienie, nie petla.
  if (odp.status === 401 && zToken && !ponowione) {
    token = null;
    tokenWazneDo = 0;
    return zadanie(sciezka, { metoda, cialo, zToken, ponowione: true });
  }

  const tekst = await odp.text();
  let dane = null;
  try {
    dane = tekst ? JSON.parse(tekst) : null;
  } catch (e) {
    dane = null;
  }
  if (!odp.ok) {
    const komunikat = (dane && (dane.error_description || dane.message || dane.error))
      || `tpay odpowiedział błędem ${odp.status}.`;
    throw new BladTpay(String(komunikat), odp.status);
  }
  return dane;
}

async function pobierzToken() {
  if (!skonfigurowany()) throw new BladTpay('Płatności online nie są skonfigurowane.');
  // Minuta zapasu — zadanie wyslane w ostatniej sekundzie waznosci wraca 401.
  if (token && Date.now() < tokenWazneDo - 60_000) return token;

  // `/oauth/auth` przyjmuje FORMULARZ, nie JSON — wysylka jako JSON konczy sie
  // bledem autoryzacji, a komunikat nie mowi dlaczego.
  const dane = await zadanie('/oauth/auth', {
    metoda: 'POST',
    zToken: false,
    formularz: true,
    cialo: {
      client_id: konfiguracja.TPAY.client_id,
      client_secret: konfiguracja.TPAY.client_secret,
    },
  });
  if (!dane || !dane.access_token) throw new BladTpay('tpay nie zwrócił tokenu dostępu.');
  token = dane.access_token;
  tokenWazneDo = Date.now() + (Number(dane.expires_in || 7200) * 1000);
  return token;
}

/**
 * Zaklada transakcje i oddaje `{ tpay_id, link }`.
 *
 * `crc` to NASZ identyfikator — wraca w powiadomieniu i po nim, a nie po
 * kwocie, laczymy powiadomienie z oplata.
 *
 * Bez obiektu `payer`: klient sam podaje adres w formularzu tpay i sam
 * dostaje potwierdzenie, a my nie przechowujemy jego danych platniczych.
 * Nasz niezalezny kanal to `callbacks.notification.url`.
 */
async function zalozTransakcje({ kwotaGrosze, opis, crc, urlPowrotu, urlPowiadomienia, emailPowiadomien }) {
  const cialo = {
    amount: Number((kwotaGrosze / 100).toFixed(2)),
    currency: 'PLN',
    // Limit 128 znakow. Kasa poprzedza opis slowami „Płatność za …", wiec
    // zaczyna sie on rzeczownikiem w dopelniaczu, nie nazwa kancelarii —
    // odbiorca i tak jest pokazany osobno.
    description: String(opis).slice(0, 128),
    hiddenDescription: crc,
    lang: 'pl',
    callbacks: {
      payerUrls: { success: urlPowrotu, error: urlPowrotu },
      // `notification.email` to NASZ niezalezny kanal: klient dostaje
      // potwierdzenie na adres, ktory sam poda w kasie, a my swoje — bez
      // wzgledu na to, co wpisal.
      notification: emailPowiadomien
        ? { url: urlPowiadomienia, email: emailPowiadomien }
        : { url: urlPowiadomienia },
    },
  };

  let dane;
  try {
    dane = await zadanie('/transactions', { metoda: 'POST', cialo });
  } catch (e) {
    // Obiektu `payer` NIE wysylamy swiadomie: podany blokuje pola w kasie,
    // wiec klient nie moze wpisac wlasnego adresu i potwierdzenie idzie nie
    // do niego. Biblioteka referencyjna oznacza go jednak jako wymagany —
    // gdyby API kiedys tego dopilnowalo, ponawiamy RAZ z wartosciami
    // zastepczymi, zamiast zostawiac klienta bez mozliwosci zaplaty.
    if (!/payer/i.test(String(e.message))) throw e;
    dane = await zadanie('/transactions', {
      metoda: 'POST',
      cialo: { ...cialo, payer: { email: emailPowiadomien || 'brak@example.invalid', name: 'Płatnik' } },
    });
  }

  return {
    tpay_id: String(dane.transactionId || ''),
    link: dane.transactionPaymentUrl || null,
    tytul: dane.title || null,
  };
}

/** Awaryjne odpytanie o stan transakcji, gdy powiadomienie nie doszlo. */
async function stanTransakcji(tpayId) {
  const dane = await zadanie(`/transactions/${encodeURIComponent(tpayId)}`);
  return { status: mapujStatus(dane && dane.status), surowy: (dane && dane.status) || '', surowe: dane };
}

/**
 * Uniewaznienie transakcji u OPERATORA. Bez tego zmiana kwoty zostawiala
 * u tpay zywy link na stara kwote — klient, ktory mial go w mailu, mogl
 * zaplacic nieaktualna nalezność i mielibysmy wplate bez pokrycia.
 */
async function anulujTransakcje(tpayId) {
  await zadanie(`/transactions/${encodeURIComponent(tpayId)}/cancel`, { metoda: 'POST', cialo: {} });
}

/**
 * Adresy, z ktorych operator wysyla powiadomienia. Warstwa UZUPELNIAJACA
 * i swiadomie luzna: adresy sie zmieniaja, wiec brak na liscie nie odrzuca
 * powiadomienia — zostaje w logu jako sygnal do sprawdzenia. Odrzuca
 * wylacznie suma kontrolna i podpis.
 */
const ADRESY_OPERATORA = [
  '176.119.38.175', '195.149.229.109', '148.251.96.163',
  '178.32.201.77', '46.248.167.59', '46.29.19.106',
];

function zAdresuOperatora(ip) {
  if (!ip) return false;
  // Za odwrotnym posrednikiem adres przychodzi czasem jako ::ffff:1.2.3.4.
  const czysty = String(ip).replace(/^::ffff:/, '');
  return ADRESY_OPERATORA.includes(czysty);
}

/**
 * Certyfikat, ktorym operator podpisuje powiadomienia (JWS). Pobierany raz
 * i trzymany w pamieci procesu — jak token.
 */
let certyfikat = null;

function adresCertyfikatu() {
  return /sandbox/i.test(konfiguracja.TPAY.api_url || '')
    ? 'https://secure.sandbox.tpay.com'
    : 'https://secure.tpay.com';
}

async function pobierzCertyfikat() {
  if (certyfikat) return certyfikat;
  const odp = await fetch(`${adresCertyfikatu()}/x509/notifications-jws.pem`);
  if (!odp.ok) throw new BladTpay(`Nie udało się pobrać certyfikatu powiadomień (${odp.status}).`);
  certyfikat = await odp.text();
  return certyfikat;
}

function zBase64Url(tekst) {
  return Buffer.from(String(tekst).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Podpis JWS z naglowka `X-JWS-Signature`. Format: `naglowek..podpis` —
 * czesc srodkowa jest PUSTA (payload odlaczony), a podpisem objete jest
 * `naglowek + '.' + base64url(surowe cialo zadania)`.
 *
 * Dlatego ta funkcja bierze SUROWE cialo, a nie sparsowane pola: kolejnosc
 * i kodowanie musza byc dokladnie takie, jakie przyszly. Sparsowanie
 * i ponowne zlozenie zmienia bajty i podpis przestaje sie zgadzac.
 *
 * Zwraca `{ ok, powod }`; nigdy nie rzuca.
 */
async function sprawdzPodpisJws(naglowekJws, suroweCialo) {
  if (!naglowekJws) return { ok: false, powod: 'Brak nagłówka X-JWS-Signature.' };
  const czesci = String(naglowekJws).split('.');
  if (czesci.length !== 3) return { ok: false, powod: 'Nagłówek X-JWS-Signature ma nieoczekiwany kształt.' };

  const [naglowek, srodek, podpis] = czesci;
  if (srodek !== '') return { ok: false, powod: 'Podpis JWS nie jest odłączony od treści.' };

  let algorytm;
  try {
    algorytm = JSON.parse(zBase64Url(naglowek).toString('utf8')).alg;
  } catch (e) {
    return { ok: false, powod: 'Nagłówek podpisu nie daje się odczytać.' };
  }
  // Wylacznie RS256. „alg: none" i algorytmy symetryczne to klasyczne
  // obejscie podpisu JWS — nie przyjmujemy niczego, czego nie wybralismy.
  if (algorytm !== 'RS256') return { ok: false, powod: `Nieobsługiwany algorytm podpisu: ${algorytm}.` };

  let pem;
  try {
    pem = await pobierzCertyfikat();
  } catch (e) {
    return { ok: false, powod: e.message };
  }

  const doPodpisu = `${naglowek}.${Buffer.from(suroweCialo).toString('base64url')}`;
  const weryfikator = crypto.createVerify('RSA-SHA256');
  weryfikator.update(doPodpisu);
  weryfikator.end();

  let zgadza;
  try {
    zgadza = weryfikator.verify(new crypto.X509Certificate(pem).publicKey, zBase64Url(podpis));
  } catch (e) {
    return { ok: false, powod: 'Nie udało się zweryfikować podpisu JWS.' };
  }
  return zgadza ? { ok: true, powod: null } : { ok: false, powod: 'Podpis JWS się nie zgadza.' };
}

/**
 * Sprawdza AUTENTYCZNOSC powiadomienia, w dwoch warstwach.
 *
 * 1. Suma MD5 `md5(id + tr_id + tr_amount + tr_crc + sekret)` — klasyczny
 *    mechanizm tpay, liczony na polach, ktore przyszly.
 * 2. Podpis JWS z naglowka `X-JWS-Signature` — gdy przyszedl. Nie zastepuje
 *    sumy MD5, tylko ja WZMACNIA; brak naglowka nie przepuszcza niczego,
 *    czego nie przepuscilaby warstwa pierwsza.
 *
 * Trzecia warstwa — lista adresow IP tpay — mieszka w trasie, bo wymaga
 * dostepu do zadania HTTP, i jest LUZNA: adresy sie zmieniaja.
 *
 * Zwraca `{ ok, powod }`. Nigdy nie rzuca: powiadomienie z falszywym
 * podpisem to zdarzenie do zalogowania, nie blad 500.
 */
function sprawdzPodpisItn(pola) {
  const sekret = konfiguracja.TPAY.notification_secret;
  if (!sekret) return { ok: false, powod: 'Sekret powiadomień nie jest skonfigurowany.' };

  const wymagane = ['id', 'tr_id', 'tr_amount', 'tr_crc', 'md5sum'];
  for (const k of wymagane) {
    if (pola[k] === undefined || pola[k] === null || pola[k] === '') {
      return { ok: false, powod: `Powiadomienie bez pola „${k}”.` };
    }
  }

  const oczekiwana = crypto
    .createHash('md5')
    .update(`${pola.id}${pola.tr_id}${pola.tr_amount}${pola.tr_crc}${sekret}`)
    .digest('hex');

  // Porownanie w czasie stalym — suma kontrolna jest sekretem pochodnym.
  const podana = String(pola.md5sum).toLowerCase();
  if (podana.length !== oczekiwana.length
      || !crypto.timingSafeEqual(Buffer.from(podana), Buffer.from(oczekiwana))) {
    return { ok: false, powod: 'Suma kontrolna powiadomienia się nie zgadza.' };
  }
  return { ok: true, powod: null };
}

/**
 * Mapa statusow operatora na nasze. Defensywna z zalozenia: LISTA WARTOSCI
 * PO STRONIE TPAY BYWA ROZSZERZANA, a pomylka w strone „oplacona" kosztuje
 * pieniadze kancelarii. Cokolwiek nierozpoznanego to „oczekuje".
 */
const MAPA_STATUSOW = {
  correct: 'oplacona', paid: 'oplacona', true: 'oplacona',
  declined: 'nieudana', error: 'nieudana', false: 'nieudana',
  chargeback: 'anulowana', canceled: 'anulowana', cancelled: 'anulowana',
  pending: 'oczekuje', new: 'oczekuje',
};

function mapujStatus(surowy) {
  return MAPA_STATUSOW[String(surowy || '').toLowerCase()] || 'oczekuje';
}

/**
 * Status z POWIADOMIENIA. `tr_status` przyjmuje `TRUE`, `PAID` albo
 * `CHARGEBACK` — sprawdzanie samego `TRUE` przepuszczalo `PAID` jako
 * „oczekuje", czyli zaplacona naleznosc nigdy by sie nie zaksiegowala.
 */
function statusZPowiadomienia(trStatus, trError) {
  const status = mapujStatus(trStatus);
  if (status !== 'oplacona') return status;
  // Kod bledu przy statusie „zaplacone" odbiera mu wiarygodnosc.
  const blad = String(trError || '').toLowerCase();
  return (blad === 'none' || blad === '') ? 'oplacona' : 'nieudana';
}

/** Kwota z powiadomienia („12.34") na grosze, bez bledu zmiennoprzecinkowego. */
function kwotaNaGrosze(tekst) {
  const czyste = String(tekst).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(czyste)) return null;
  const [calosci, koncowka = ''] = czyste.split('.');
  return Number(calosci) * 100 + Number(koncowka.padEnd(2, '0'));
}

module.exports = {
  BladTpay,
  skonfigurowany,
  sprawdzPodpisJws,
  zAdresuOperatora,
  ADRESY_OPERATORA,
  zalozTransakcje,
  stanTransakcji,
  anulujTransakcje,
  mapujStatus,
  sprawdzPodpisItn,
  statusZPowiadomienia,
  kwotaNaGrosze,
  // Do testow: pozwala wyzerowac token miedzy przymiarkami.
  _zapomnijToken: () => { token = null; tokenWazneDo = 0; },
};
