'use strict';

/**
 * Adresy sieci kancelarii (audyt W2): aplikacja sama pilnuje, żeby trasy pracowników odpowiadały tylko
 * adresom z listy `KANCELARIA_ADRESY` — zapora i nginx zostają, ale błąd w ich konfiguracji nie wystawia
 * logowania pracowników do internetu. Lista: adresy IPv4 dokładne albo z maską (`192.168.1.0/24`) oraz
 * dokładne adresy IPv6. Pusta lista = bez ograniczenia.
 */

/** IPv4 jako liczba 32-bitowa albo null. Przyjmuje też postać `::ffff:192.168.1.7`. */
function ipv4(adres) {
  const tekst = String(adres || '').trim().replace(/^::ffff:/i, '');
  const czesci = tekst.split('.');
  if (czesci.length !== 4) return null;
  let wynik = 0;
  for (const c of czesci) {
    if (!/^\d{1,3}$/.test(c) || Number(c) > 255) return null;
    wynik = wynik * 256 + Number(c);
  }
  return wynik;
}

function pasuje(ip, wzorzec) {
  const [siec, maskaTekst] = String(wzorzec).trim().split('/');
  const a = ipv4(ip);
  const b = ipv4(siec);
  if (a === null || b === null) return maskaTekst === undefined && String(ip).trim().toLowerCase() === siec.toLowerCase();
  const maska = maskaTekst === undefined ? 32 : Number(maskaTekst);
  if (!Number.isInteger(maska) || maska < 0 || maska > 32) return false;
  const dzielnik = 2 ** (32 - maska);
  return Math.floor(a / dzielnik) === Math.floor(b / dzielnik);
}

/** Czy adres należy do listy; pętla zwrotna (`127.0.0.1`, `::1`) należy zawsze, gdy lista ją wymienia jak każdy inny adres. */
function nalezy(ip, lista) {
  if (!Array.isArray(lista) || lista.length === 0) return true;
  return lista.some((wzorzec) => pasuje(ip, wzorzec));
}

/** `192.168.1.0/24, 203.0.113.10` → tablica wzorców; błędny wzorzec zatrzymuje start (literówka nie może otworzyć dostępu). */
function wczytajListe(tekst) {
  const lista = String(tekst || '').split(',').map((x) => x.trim()).filter(Boolean);
  for (const wzorzec of lista) {
    const [siec, maska] = wzorzec.split('/');
    const poprawny = ipv4(siec) !== null ? maska === undefined || (/^\d{1,2}$/.test(maska) && Number(maska) <= 32) : maska === undefined && siec.includes(':');
    if (!poprawny) throw new Error(`KANCELARIA_ADRESY: nieprawidłowy adres „${wzorzec}”. Podaj adresy IPv4 (także z maską, np. 192.168.1.0/24) albo IPv6, rozdzielone przecinkami.`);
  }
  return lista;
}

module.exports = { nalezy, wczytajListe };
