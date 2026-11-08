'use strict';

/**
 * Maskowanie danych wrazliwych (regula domenowa nr 9, art. 300(35) § 1(1) KSH).
 *
 * Pozostali akcjonariusze NIE maja dostepu do numeru PESEL, daty urodzenia
 * ani adresu zamieszkania. Pelny dostep: kancelaria, sama osoba, spolka,
 * sady, prokuratura, komornicy i administracyjne organy egzekucyjne.
 *
 * Sprint 1 nie ma jeszcze portalu klienta, ale maskowanie wdrazamy od
 * pierwszego dnia (sekcja 3 specyfikacji) - korzysta z niego wydruk
 * "informacja z rejestru" kierowany do innego akcjonariusza.
 */

const przepisy = require('./przepisy');

const ZASLONA = '•••';

/**
 * @param {object} osoba      rekord `psa_osoby`
 * @param {string} rola       jedna z `przepisy.ROLE_ODBIORCY`
 * @param {number} [odbiorcaOsobaId] id osoby ogladajacej - wlasne dane widzi w calosci
 *
 * Naprawa Z-150: buduje odpowiedz z BIALEJ LISTY pol dozwolonych dla danej
 * roli (`przepisy.BIALE_LISTY`), nie przez usuwanie pol z pelnego obiektu.
 * Kazde pole spoza listy jest pomijane - w tym kazde NOWE pole dopisane
 * kiedykolwiek do `psa_osoby`, o ktorym ta funkcja jeszcze nie wie, jest
 * wiec z definicji NIEWIDOCZNE, a nie domyslnie wyciekajace. Rola nieznana
 * (literowka, brak w slowniku) dostaje najwezszy zakres (tozsamosc), fail
 * closed, nie fail open.
 */
function zamaskujOsobe(osoba, rola, odbiorcaOsobaId = null) {
  if (!osoba) return null;

  const wlasneDane = odbiorcaOsobaId != null && Number(odbiorcaOsobaId) === Number(osoba.id);
  if (wlasneDane || przepisy.BIALE_LISTY[rola] === null) {
    return { ...osoba, zamaskowane: false };
  }

  const bialaLista = przepisy.BIALE_LISTY[rola] || przepisy.POLA_TOZSAMOSCI;
  // Pola wrazliwe/kontaktowe pomijane przez biala liste dostaja WIDOCZNY
  // placeholder (UI pokazuje "to pole istnieje, jest ukryte"); wszystko inne
  // pomijane (AML/PEP/kancelaryjne, kazde inne, nieznane dzis pole) znika z
  // odpowiedzi w calosci - nie ma powodu sygnalizowac peer-akcjonariuszowi
  // czy spolce, ze w ogole istnieje np. notatka AML.
  const POLA_Z_PLACEHOLDEREM = [...przepisy.POLA_WRAZLIWE, ...przepisy.POLA_KONTAKTOWE];
  const wynik = {};
  const zamaskowane_pola = [];
  for (const [klucz, wartosc] of Object.entries(osoba)) {
    if (bialaLista.includes(klucz)) {
      wynik[klucz] = wartosc;
      continue;
    }
    if (wartosc == null || wartosc === '') continue;
    zamaskowane_pola.push(klucz);
    if (POLA_Z_PLACEHOLDEREM.includes(klucz)) wynik[klucz] = ZASLONA;
  }
  // Poz. 23: maskuje się wyłącznie adres zamieszkania osoby fizycznej — siedziba osoby prawnej
  // i adres do doręczeń są jawne dla każdego akcjonariusza.
  if (wynik.adres === ZASLONA && (osoba.typ === 'prawna' || osoba.rodzaj_adresu === 'doreczen')) {
    wynik.adres = osoba.adres;
    zamaskowane_pola.splice(zamaskowane_pola.indexOf('adres'), 1);
  }
  wynik.zamaskowane = true;
  wynik.zamaskowane_pola = zamaskowane_pola;
  return wynik;
}

const dataPl = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * Opis akcjonariusza do informacji z rejestru (U-27): imię i nazwisko albo firma, PESEL albo data
 * urodzenia (osoba prawna — numer w rejestrze), adres, e-mail przy zgodzie — wyłącznie pola, które
 * przepuszcza biała lista odbiorcy. Bez dopisków o pominięciu.
 */
function opisOsoby(osoba, rola, odbiorcaOsobaId = null) {
  const o = zamaskujOsobe(osoba, rola, odbiorcaOsobaId);
  const jawne = (v) => v != null && v !== '' && v !== ZASLONA;
  const linie = [o.nazwa];
  if (o.typ === 'prawna') {
    if (jawne(o.numer_rejestru)) linie.push(`nr w rejestrze ${o.numer_rejestru}`);
  } else if (jawne(o.pesel)) linie.push(`PESEL ${o.pesel}`);
  else if (jawne(o.data_urodzenia)) linie.push(`ur. ${dataPl(o.data_urodzenia)}`);
  if (jawne(o.adres)) linie.push(o.rodzaj_adresu === 'doreczen' ? `adres do doręczeń: ${o.adres}` : o.adres);
  if (jawne(o.email) && o.zgoda_email) linie.push(o.email);
  return linie.join('\n');
}

/**
 * Czy biala lista danej roli w ogole ujawnia POLA_WRAZLIWE (PESEL, data
 * urodzenia, adres) cudzych osob - Z-152/P-009: `zamaskowane` z
 * `zamaskujOsobe` mowi "cokolwiek zostalo ukryte" (np. samo AML/PEP dla
 * roli "spolka" tez to ustawia), a dziennik dostepu ma odpowiadac na
 * WEZSZE pytanie: czy dane WRAZLIWE wyszly niezamaskowane.
 */
function widziWrazliweDaneInnych(rola) {
  const lista = przepisy.BIALE_LISTY[rola];
  if (lista === null) return true;
  return przepisy.POLA_WRAZLIWE.some((pole) => lista.includes(pole));
}

module.exports = { ZASLONA, zamaskujOsobe, opisOsoby, widziWrazliweDaneInnych };
