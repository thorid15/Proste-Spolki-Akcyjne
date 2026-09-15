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

/**
 * Drugi licznik, liczony po SAMYM ADRESIE. Klucz `IP + e-mail` broni przed
 * zgadywaniem hasla do JEDNEGO konta, ale nie przed ROZPYLANIEM: ten sam
 * atakujacy bierze jedno popularne haslo i przechodzi po stu adresach
 * e-mail, za kazdym razem z nowym kluczem, wiec pierwszy licznik nigdy nie
 * dochodzi do piatki. Sprawdzone sonda: 25 kont z jednego adresu przeszlo
 * bez blokady.
 *
 * Limit jest WYRAZNIE WYZSZY niz na jedno konto, bo kancelaria pracuje zza
 * jednego adresu NAT-owanego i kilka pomylek kilku osob w kwadrans to
 * normalny dzien, nie atak.
 */
const LIMIT_IP = 30;

const proby = new Map(); // klucz -> znaczniki czasu nieudanych prob

function klucz(ip, identyfikator) {
  return `${ip}::${String(identyfikator || '').toLowerCase()}`;
}

function kluczIp(ip) {
  return `ip::${ip}`;
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
  // Najpierw licznik adresu — inaczej rozpylanie hasla po wielu kontach
  // nigdy nie zapelnia zadnego licznika z osobna.
  if (opcje.bezLicznikaIp !== true) sprawdzLicznik(kluczIp(ip), LIMIT_IP, opcje);
  sprawdzLicznik(klucz(ip, identyfikator), opcje.limit || LIMIT, opcje);
}

function sprawdzLicznik(k, dopuszczalne, opcje = {}) {
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

function zanotuj(k) {
  const teraz = Date.now();
  const aktywne = oczysc(proby.get(k) || [], teraz);
  aktywne.push(teraz);
  proby.set(k, aktywne);
}

function zanotujNieudana(ip, identyfikator) {
  zanotuj(klucz(ip, identyfikator));
  zanotuj(kluczIp(ip));
}

/**
 * Udane logowanie czysci licznik TEGO KONTA, ale NIE licznika adresu:
 * atakujacy, ktory po dwudziestu probach trafil jedno konto, nie ma dostac
 * w nagrode czystego licznika na kolejne dwadziescia.
 */
function wyczyscPoUdanej(ip, identyfikator) {
  proby.delete(klucz(ip, identyfikator));
}

module.exports = { sprawdz, zanotujNieudana, wyczyscPoUdanej, OKNO_MS, LIMIT, LIMIT_IP };
