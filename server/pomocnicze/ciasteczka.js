'use strict';

/**
 * Ciasteczka sesji - minimalny parser/serializator wlasny. Express nie
 * parsuje `Cookie` bez `cookie-parser`, ktorego nie ma na liscie zaleznosci
 * (sekcja 13); potrzeby modulu ograniczaja sie do jednej pary klucz/wartosc
 * na ciasteczko, wiec pelny pakiet byłby nadmiarowy.
 */

function parsuj(naglowek) {
  const wynik = {};
  if (!naglowek) return wynik;
  for (const czesc of String(naglowek).split(';')) {
    const rozdzial = czesc.indexOf('=');
    if (rozdzial === -1) continue;
    const nazwa = czesc.slice(0, rozdzial).trim();
    if (!nazwa) continue;
    let wartosc = czesc.slice(rozdzial + 1).trim();
    try {
      wartosc = decodeURIComponent(wartosc);
    } catch {
      /* wartosc niepoprawnie zakodowana - bierzemy surowa */
    }
    wynik[nazwa] = wartosc;
  }
  return wynik;
}

/**
 * @param {string} nazwa
 * @param {string} wartosc
 * @param {{maxAgeMs?: number, wymuszajHttps?: boolean}} opcje  brak maxAgeMs = ciasteczko sesyjne
 */
function ustaw(odp, nazwa, wartosc, opcje = {}) {
  const czesci = [`${nazwa}=${encodeURIComponent(wartosc)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (opcje.maxAgeMs != null) czesci.push(`Max-Age=${Math.floor(opcje.maxAgeMs / 1000)}`);
  if (opcje.wymuszajHttps) czesci.push('Secure');
  odp.append('Set-Cookie', czesci.join('; '));
}

function usun(odp, nazwa, opcje = {}) {
  const czesci = [`${nazwa}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (opcje.wymuszajHttps) czesci.push('Secure');
  odp.append('Set-Cookie', czesci.join('; '));
}

/** Middleware - wypelnia `zad.ciasteczka`. */
function posrednik(zad, odp, dalej) {
  zad.ciasteczka = parsuj(zad.headers.cookie);
  dalej();
}

module.exports = { parsuj, ustaw, usun, posrednik };
