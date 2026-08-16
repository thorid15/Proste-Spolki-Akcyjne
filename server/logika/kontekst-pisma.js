'use strict';

/**
 * Kontekst danych dla automatu pism — cztery wzory, które wysyła się same
 * przy przejściach stanu sprawy (blok A3 sesji 8):
 *
 *   05 — powiadomienie o zamierzonym wpisie (art. 300(34) § 3 KSH)
 *   06 — wezwanie do usunięcia przeszkody
 *   07 — zawiadomienie o dokonaniu wpisu (art. 300(34) § 7 zd. 1 KSH)
 *   09 — zawiadomienie o niedokonaniu wpisu (art. 300(34) § 7 zd. 2 KSH)
 *
 * Wzory 01/02/03/08/10 (umowa, RODO, uchwała, lista dla sądu, klauzula
 * zbycia) są jednorazowe albo wystawiane na żądanie, nie automatem — ich
 * kontekst buduje się przy wystawianiu (blok A5), nie tutaj.
 *
 * Klucz, którego tu NIE MA (np. `dokument_rodzaj` przy sprawie bez
 * wskazanego dokumentu), po prostu nie trafia do zwracanego obiektu —
 * renderer (`logika/docx.js`) sam dopisze go do listy braków. Ten moduł
 * nigdy nie wstawia wartości zastępczych.
 */

const przepisy = require('./przepisy');
const konfiguracja = require('../konfiguracja');
const widoki = require('../widoki');

// ─────────────────────────────────────────────────────────────
// Formatowanie wspólne
// ─────────────────────────────────────────────────────────────

function dataPl(iso) {
  if (!iso) return null;
  const [r, m, d] = String(iso).slice(0, 10).split('-');
  if (!r || !m || !d) return null;
  return `${d}.${m}.${r}`;
}

/** Godzina z `psa_zdarzenia.data_wpisu` (ISO z sekundami) — do minuty. */
function godzina(isoZChwila) {
  if (!isoZChwila || !String(isoZChwila).includes('T')) return null;
  return String(isoZChwila).slice(11, 16);
}

/** Imię i nazwisko / nazwa w mianowniku — kolejność jak w piśmie, nie jak na liście. */
function mianownik(osoba) {
  if (!osoba) return null;
  if (osoba.typ === 'prawna') return osoba.nazwa || null;
  return [osoba.imie, osoba.nazwisko].filter(Boolean).join(' ') || null;
}

/** Adres jednym ciągiem — ten sam kształt dla osoby i dla spółki (te same nazwy pól). */
function adresPelny(podmiot) {
  if (!podmiot) return null;
  if (podmiot.adres_doreczen) return podmiot.adres_doreczen;
  const numer = [podmiot.nr_domu, podmiot.nr_lokalu].filter(Boolean).join('/');
  const ulica = [podmiot.ulica, numer && `nr ${numer}`].filter(Boolean).join(' ');
  const kodMiasto = [podmiot.kod_pocztowy, podmiot.miejscowosc].filter(Boolean).join(' ');
  return [kodMiasto, ulica && `ulica ${ulica}`].filter(Boolean).join(', ') || null;
}

/**
 * Sąd rejestrowy z wydziałem. `wydzial` jest wolnym tekstem (notariusz wpisuje
 * przy rejestracji spółki) — jeśli już zawiera pełną nazwę wydziału, zostaje
 * bez zmian; jeśli jest skrótem („XII Wydział Gospodarczy”), dopisujemy
 * standardowy sufiks, żeby zdanie było gramatycznie kompletne.
 */
function sadRejestrowyPelny(spolka) {
  if (!spolka.sad_rejestrowy) return null;
  if (!spolka.wydzial) return spolka.sad_rejestrowy;
  const wydzial = /rejestru s.dowego/i.test(spolka.wydzial)
    ? spolka.wydzial
    : `${spolka.wydzial} Krajowego Rejestru Sądowego`;
  return `${spolka.sad_rejestrowy}, ${wydzial}`;
}

// ─────────────────────────────────────────────────────────────
// Bloki wspólne dla każdego pisma
// ─────────────────────────────────────────────────────────────

/** `kancelaria_*` / `notariusz_*` / `podpisujacy_*` — jeden do jednego z konfiguracji (blok A2). */
function kancelariaKlucze() {
  const k = konfiguracja.KANCELARIA;
  return {
    notariusz_mianownik: k.notariusz_mianownik || null,
    notariusz_dopelniacz: k.notariusz_dopelniacz || null,
    notariusz_narzednik: k.notariusz_narzednik || null,
    podpisujacy_funkcja: k.podpisujacy_funkcja || null,
    podpisujacy_mianownik: k.podpisujacy_mianownik || null,
    kancelaria_miasto: k.kancelaria_miasto || null,
    kancelaria_miasto_miejscownik: k.kancelaria_miasto_miejscownik || null,
    kancelaria_ulica: k.kancelaria_ulica || null,
    kancelaria_kod: k.kancelaria_kod || null,
    kancelaria_email: k.email || null,
    kancelaria_telefon: k.telefon || null,
    kancelaria_nip: k.kancelaria_nip || null,
    kancelaria_regon: k.kancelaria_regon || null,
  };
}

/** `spolka_*` — z rekordu `psa_spolki` (siedziba_miejscownik: blok B4, organ_rodzaj: blok A3). */
function spolkaKlucze(spolka) {
  const organ = spolka.organ_rodzaj ? przepisy.OPISY_ORGANOW[spolka.organ_rodzaj] : null;
  return {
    spolka_firma: spolka.nazwa || null,
    spolka_siedziba_mianownik: spolka.miejscowosc || null,
    spolka_siedziba_miejscownik: spolka.siedziba_miejscownik || null,
    spolka_adres_pelny: adresPelny(spolka),
    spolka_sad_rejestrowy: sadRejestrowyPelny(spolka),
    spolka_krs: spolka.krs || null,
    spolka_nip: spolka.nip || null,
    spolka_regon: spolka.regon || null,
    spolka_email: spolka.email || null,
    spolka_organ: organ ? organ.organ : null,
    spolka_organ_czlonkowie: organ ? organ.czlonkowie : null,
  };
}

/** `sprawa_numer` / `pismo_data` — na każdym piśmie. `dzis` to data sporządzenia PISMA, nie zdarzenia. */
function pismoKlucze(sprawa, dzis) {
  return {
    sprawa_numer: sprawa.numer || null,
    pismo_data: dataPl(dzis),
  };
}

/** `pozycja_*` — sekcja „stan rejestru po wpisie”, z `widoki.widokStanu(..., {rola: KANCELARIA})`. */
function pozycjeKlucze(akcjonariusze) {
  return (akcjonariusze || []).map((a) => ({
    pozycja_akcjonariusz: mianownik(a.osoba),
    pozycja_seria: a.seria,
    pozycja_numery: a.numery,
    pozycja_liczba: String(a.ilosc),
    pozycja_obciazenia: opiszObciazenia(a.obciazenia),
  }));
}

function opiszObciazenia(obciazenia) {
  if (!obciazenia || obciazenia.length === 0) return 'brak';
  return obciazenia
    .map((o) => {
      const rodzaj = o.typ === 'uzytkowanie' ? 'użytkowanie' : 'zastaw';
      const uprawniony = mianownik(o.uprawniony);
      return uprawniony ? `${rodzaj} na rzecz ${uprawniony}` : rodzaj;
    })
    .join('; ');
}

/**
 * `wpis_opis` dla pism sprzed dokonania wpisu (wezwanie, odmowa,
 * powiadomienie uprzednie) — zdarzenie jeszcze nie istnieje, więc opis
 * budujemy z ROBOCZEGO stanu kreatora (`dane_wejsciowe_json`, krok
 * „podgląd"). Sprawa, która nigdy nie doszła do tego kroku, nie ma czego
 * opisać — zwracamy `null`, klucz trafia na listę braków, nie znika po cichu.
 */
function wpisOpisZDraftu(sprawa, osoby) {
  if (!sprawa.dane_wejsciowe_json) return null;
  try {
    const { dane } = JSON.parse(sprawa.dane_wejsciowe_json);
    return widoki.podsumujZdarzenie({ typ: sprawa.typ_zdarzenia, dane: dane || {} }, osoby);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Kontekst per wzór
// ─────────────────────────────────────────────────────────────

/**
 * Wzór 07 — zawiadomienie o dokonaniu wpisu. Wysyła się DWA egzemplarze
 * (żądającemu i spółce, art. 300(34) § 7 zd. 1 KSH) — `wariant` przełącza,
 * który z nich to jest, bo od tego zależy zarówno adresat, jak i to, która
 * z sekcji `adresat_zadajacy`/`adresat_spolka` jest włączona.
 */
function zawiadomienieWpisu({ spolka, sprawa, zdarzenie, wpisOpis, zadajacy, akcjonariusze, wariant, dzis }) {
  const charakter = przepisy.charakterWpisu(zdarzenie.typ, (zdarzenie.dane || {}).tytul_prawny);
  const doZadajacego = wariant === 'zadajacy';

  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    ...pismoKlucze(sprawa, dzis),
    adresat_nazwa: doZadajacego ? mianownik(zadajacy) : spolka.nazwa || null,
    adresat_adres: doZadajacego ? adresPelny(zadajacy) : adresPelny(spolka),
    adresat_zadajacy: doZadajacego ? [{}] : [],
    adresat_spolka: doZadajacego ? [] : [{}],
    dokument_rodzaj: sprawa.dokument_rodzaj ? przepisy.OPISY_RODZAJOW_DOKUMENTU[sprawa.dokument_rodzaj] : null,
    dokument_data: dataPl(sprawa.dokument_data),
    zadajacy_mianownik: mianownik(zadajacy),
    zadanie_data_wplywu: dataPl(sprawa.data_wplywu),
    wpis_data: dataPl(zdarzenie.data_wpisu),
    wpis_godzina: godzina(zdarzenie.data_wpisu),
    wpis_opis: wpisOpis || null,
    wpis_konstytutywny: charakter === przepisy.CHARAKTER_WPISU.KONSTYTUTYWNY ? [{}] : [],
    wpis_deklaratoryjny: charakter === przepisy.CHARAKTER_WPISU.DEKLARATORYJNY ? [{}] : [],
    pozycje: pozycjeKlucze(akcjonariusze),
  };
}

/** Wzór 09 — zawiadomienie o niedokonaniu wpisu (zawsze do żądającego). */
function zawiadomienieNiedokonania({ spolka, sprawa, zadajacy, osoby, dzis }) {
  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    ...pismoKlucze(sprawa, dzis),
    adresat_nazwa: mianownik(zadajacy),
    adresat_adres: adresPelny(zadajacy),
    zadanie_data_wplywu: dataPl(sprawa.data_wplywu),
    wpis_opis: wpisOpisZDraftu(sprawa, osoby),
    przyczyny: sprawa.powod_odmowy ? [{ przyczyna_opis: sprawa.powod_odmowy }] : [],
  };
}

/** Wzór 06 — wezwanie do usunięcia przeszkody (zawsze do żądającego). */
function wezwanieDoUzupelnienia({ spolka, sprawa, zadajacy, osoby, powodWstrzymania, dzis }) {
  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    ...pismoKlucze(sprawa, dzis),
    adresat_nazwa: mianownik(zadajacy),
    adresat_adres: adresPelny(zadajacy),
    zadanie_data_wplywu: dataPl(sprawa.data_wplywu),
    wpis_opis: wpisOpisZDraftu(sprawa, osoby),
    przeszkody: powodWstrzymania ? [{ przeszkoda_opis: powodWstrzymania }] : [],
    sposob_usuniecia: sprawa.sposob_usuniecia || null,
    termin_usuniecia: dataPl(sprawa.termin_usuniecia),
  };
}

/**
 * Wzór 05 — powiadomienie o zamierzonym wpisie (art. 300(34) § 3 KSH).
 * Adresat to `odbiorca` (czyja uprawnienia mają być zmienione) — INNA osoba
 * niż `zadajacy` (kto wpisu żąda), oba mogą wystąpić na tym samym piśmie.
 *
 * `termin_stanowiska` nie ma podstawy ustawowej co do liczby dni (przepis
 * mówi tylko „w terminie umożliwiającym rozpatrzenie przed wpisem”) — tu
 * liczymy go jako wewnętrzny cel 3-dniowy (`CEL_WEWNETRZNY.WPIS_DNI`), żeby
 * pole nie zostało puste, ale to sugestia organizacyjna, nie termin prawny.
 */
function powiadomienieUprzednie({ spolka, sprawa, zadajacy, odbiorca, osoby, terminStanowiska, akcjonariusze, dzis }) {
  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    ...pismoKlucze(sprawa, dzis),
    adresat_nazwa: mianownik(odbiorca),
    adresat_adres: adresPelny(odbiorca),
    dokument_rodzaj: sprawa.dokument_rodzaj ? przepisy.OPISY_RODZAJOW_DOKUMENTU[sprawa.dokument_rodzaj] : null,
    dokument_data: dataPl(sprawa.dokument_data),
    zadajacy_mianownik: mianownik(zadajacy),
    zadanie_data_wplywu: dataPl(sprawa.data_wplywu),
    wpis_opis: wpisOpisZDraftu(sprawa, osoby),
    termin_stanowiska: dataPl(terminStanowiska),
    pozycje: pozycjeKlucze(akcjonariusze),
  };
}

module.exports = {
  dataPl,
  godzina,
  mianownik,
  adresPelny,
  sadRejestrowyPelny,
  kancelariaKlucze,
  spolkaKlucze,
  pismoKlucze,
  pozycjeKlucze,
  zawiadomienieWpisu,
  zawiadomienieNiedokonania,
  wezwanieDoUzupelnienia,
  powiadomienieUprzednie,
};
