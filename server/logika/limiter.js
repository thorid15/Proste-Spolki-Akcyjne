'use strict';

/**
 * Rate limiting logowania - wlasna implementacja, licznik w pamieci
 * (sekcja 11: "wlasna implementacja, licznik w pamieci", zadnej zaleznosci).
 *
 * Okno przesuwne: max `LIMIT` nieudanych prob na klucz w `OKNO_MS`. Klucz
 * laczy IP i identyfikator (e-mail) - blokada jednego nie usypia calej
 * kancelarii pracujacej z jednego adresu NAT-owanego.
 *
 * Pamiec jest procesowa - restart serwera czysci liczniki. Wpisy starsze
 * niz okno usuwamy przy kazdym odczycie, wiec mapa nie rosnie bez konca
 * przy normalnym ruchu.
 */

const OKNO_MS = 15 * 60 * 1000; // 15 minut
const LIMIT = 5;

const proby = new Map(); // klucz -> znaczniki czasu nieudanych prob

function klucz(ip, identyfikator) {
  return `${ip}::${String(identyfikator || '').toLowerCase()}`;
}

function oczysc(znaczniki, teraz) {
  return znaczniki.filter((t) => teraz - t < OKNO_MS);
}

/**
 * @param {object} [opcje]
 * @param {number} [opcje.limit]     ile prob miesci sie w oknie (domyslnie LIMIT)
 * @param {string} [opcje.komunikat] tekst z `%MIN%` w miejscu liczby minut
 * @throws {BladOgraniczenia} gdy limit prob jest wyczerpany
 *
 * Komunikat jest do podmiany, bo tego samego licznika uzywa formularz
 * PUBLICZNY, gdzie zdanie o „nieudanych probach logowania" mowi o czyms,
 * czego uzytkownik w ogole nie robil.
 */
function sprawdz(ip, identyfikator, opcje = {}) {
  const dopuszczalne = opcje.limit || LIMIT;
  const k = klucz(ip, identyfikator);
  const teraz = Date.now();
  const aktywne = oczysc(proby.get(k) || [], teraz);
  if (aktywne.length === 0) {
    proby.delete(k);
  } else {
    proby.set(k, aktywne);
  }
  if (aktywne.length >= dopuszczalne) {
    const pozostaleSekundy = Math.ceil((OKNO_MS - (teraz - aktywne[0])) / 1000);
    const minuty = Math.ceil(pozostaleSekundy / 60);
    const wzor = opcje.komunikat
      || 'Za dużo nieudanych prób logowania. Spróbuj ponownie za %MIN% min.';
    const blad = new Error(wzor.replace('%MIN%', String(minuty)));
    blad.name = 'BladOgraniczenia';
    throw blad;
  }
}

function zanotujNieudana(ip, identyfikator) {
  const k = klucz(ip, identyfikator);
  const teraz = Date.now();
  const aktywne = oczysc(proby.get(k) || [], teraz);
  aktywne.push(teraz);
  proby.set(k, aktywne);
}

function wyczyscPoUdanej(ip, identyfikator) {
  proby.delete(klucz(ip, identyfikator));
}

module.exports = { sprawdz, zanotujNieudana, wyczyscPoUdanej, OKNO_MS, LIMIT };
