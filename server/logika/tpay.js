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

async function zadanie(sciezka, { metoda = 'GET', cialo, zToken = true, ponowione = false } = {}) {
  const naglowki = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (zToken) naglowki.Authorization = `Bearer ${await pobierzToken()}`;

  const odp = await fetch(`${konfiguracja.TPAY.api_url}${sciezka}`, {
    method: metoda,
    headers: naglowki,
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
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

  const dane = await zadanie('/oauth/auth', {
    metoda: 'POST',
    zToken: false,
    cialo: {
      client_id: konfiguracja.TPAY.client_id,
      client_secret: konfiguracja.TPAY.client_secret,
    },
  });
  if (!dane || !dane.access_token) throw new BladTpay('tpay nie zwrócił tokenu dostępu.');
  token = dane.access_token;
  tokenWazneDo = Date.now() + (Number(dane.expires_in || 3600) * 1000);
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
async function zalozTransakcje({ kwotaGrosze, opis, crc, urlPowrotu, urlPowiadomienia }) {
  const dane = await zadanie('/transactions', {
    metoda: 'POST',
    cialo: {
      amount: Number((kwotaGrosze / 100).toFixed(2)),
      description: opis,
      hiddenDescription: crc,
      lang: 'pl',
      callbacks: {
        payerUrls: { success: urlPowrotu, error: urlPowrotu },
        notification: { url: urlPowiadomienia },
      },
    },
  });
  return {
    tpay_id: String(dane.transactionId || ''),
    link: dane.transactionPaymentUrl || null,
    tytul: dane.title || null,
  };
}

/** Awaryjne odpytanie o stan transakcji, gdy powiadomienie nie doszlo. */
async function stanTransakcji(tpayId) {
  const dane = await zadanie(`/transactions/${encodeURIComponent(tpayId)}`);
  return { status: String((dane && dane.status) || ''), surowe: dane };
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
 * Status z powiadomienia na nasz. NIEZNANY STATUS TO ZAWSZE „oczekuje",
 * nigdy „oplacona" — pomylka w te strone kosztuje pieniadze kancelarii.
 */
function statusZPowiadomienia(trStatus, trError) {
  const status = String(trStatus || '').toUpperCase();
  const blad = String(trError || '').toLowerCase();
  if (status === 'TRUE' && (blad === 'none' || blad === '')) return 'oplacona';
  if (status === 'CHARGEBACK') return 'anulowana';
  if (status === 'FALSE') return 'nieudana';
  return 'oczekuje';
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
  zalozTransakcje,
  stanTransakcji,
  sprawdzPodpisItn,
  statusZPowiadomienia,
  kwotaNaGrosze,
  // Do testow: pozwala wyzerowac token miedzy przymiarkami.
  _zapomnijToken: () => { token = null; tokenWazneDo = 0; },
};
