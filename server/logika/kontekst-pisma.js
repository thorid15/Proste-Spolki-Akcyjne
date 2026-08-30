'use strict';

/**
 * Kontekst danych dla wszystkich dziesięciu wzorów pism.
 *
 * Cztery idą automatem, przy przejściach stanu sprawy (blok A3 sesji 8):
 *   05 — powiadomienie o zamierzonym wpisie (art. 300(34) § 3 KSH)
 *   06 — wezwanie do usunięcia przeszkody
 *   07 — zawiadomienie o dokonaniu wpisu (art. 300(34) § 7 zd. 1 KSH)
 *   09 — zawiadomienie o niedokonaniu wpisu (art. 300(34) § 7 zd. 2 KSH)
 *
 * Pięć wystawia się NA ŻĄDANIE, ze spółki, bez powiązania z konkretną sprawą
 * (blok A5 sesji 8):
 *   01 — umowa o prowadzenie rejestru       02 — załącznik: informacja RODO
 *   03 — uchwała o wyborze notariusza       08 — lista akcjonariuszy do sądu
 *   10 — klauzula do umowy zbycia akcji
 *
 * Jeden wystawia się NA ŻĄDANIE, ze SPRAWY (nie ze spółki — dotyczy danych
 * konkretnego żądającego i konkretnego zdarzenia; wykryty jako brakujący
 * dopiero przy A7, bo nie pasował do podziału na automat/spółkę z A3/A5):
 *   04 — żądanie dokonania wpisu (art. 300(34) § 1 i § 4 KSH)
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
 * Adres zamieszkania/siedziby BEZ podstawiania adresu do doręczeń — w
 * odróżnieniu od `adresPelny`, wzór 04 ma OBA jako osobne placeholdery
 * (`zadajacy_adres` i `zadajacy_adres_doreczen`), więc nie mogą się cicho
 * zlać w jedno, gdy `adres_doreczen` jest ustawiony.
 */
function adresZamieszkaniaPelny(osoba) {
  if (!osoba) return null;
  const numer = [osoba.nr_domu, osoba.nr_lokalu].filter(Boolean).join('/');
  const ulica = [osoba.ulica, numer && `nr ${numer}`].filter(Boolean).join(' ');
  const kodMiasto = [osoba.kod_pocztowy, osoba.miejscowosc].filter(Boolean).join(' ');
  return [kodMiasto, ulica && `ulica ${ulica}`].filter(Boolean).join(', ') || null;
}

/**
 * Identyfikator do dokumentu WEWNĘTRZNEGO kancelarii (żądanie wpisu, wzór
 * 04) — w odróżnieniu od `logika/maskowanie.js: jawnyIdentyfikator` (do
 * pism WYCHODZĄCYCH, gdzie PESEL jest celowo ukryty przed osobami trzecimi)
 * tu notariusz identyfikuje samą stronę czynności, więc PESEL jest właściwy.
 */
function identyfikatorWewnetrzny(osoba) {
  if (!osoba) return null;
  if (osoba.typ === 'prawna') {
    if (osoba.numer_w_rejestrze) return `${osoba.nazwa_rejestru || 'KRS'} ${osoba.numer_w_rejestrze}`;
    if (osoba.nip) return `NIP ${osoba.nip}`;
    return null;
  }
  return osoba.pesel ? `PESEL ${osoba.pesel}` : null;
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
    podpisujacy_funkcja: k.podpisujacy_funkcja || null,
    podpisujacy_mianownik: k.podpisujacy_mianownik || null,
    kancelaria_miasto: k.kancelaria_miasto || null,
    kancelaria_ulica: k.kancelaria_ulica || null,
    kancelaria_kod: k.kancelaria_kod || null,
    kancelaria_email: k.email || null,
    kancelaria_telefon: k.telefon || null,
    kancelaria_nip: k.kancelaria_nip || null,
    kancelaria_regon: k.kancelaria_regon || null,
  };
}

/**
 * `spolka_*` — z rekordu `psa_spolki` (organ_rodzaj: blok A3).
 *
 * Nazwa miejscowości występuje w pismach WYŁĄCZNIE w mianowniku, opisana
 * etykietą („siedziba: Gdańsk”) — dlatego nie ma tu drugiej formy do
 * odmiany i nie ma czego zgadywać przy nazwach nietypowych.
 */
function spolkaKlucze(spolka) {
  const organ = spolka.organ_rodzaj ? przepisy.OPISY_ORGANOW[spolka.organ_rodzaj] : null;
  return {
    spolka_firma: spolka.nazwa || null,
    spolka_siedziba_mianownik: spolka.miejscowosc || null,
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

/**
 * `reprezentant_*` — osoba podpisująca w imieniu SPÓŁKI umowę o prowadzenie
 * rejestru (wzór 01).
 *
 * Wszystkie wartości idą do pisma w MIANOWNIKU, dokładnie tak, jak wpisano
 * je w formularzu. Wzór opisuje je etykietą („imiona rodziców:”, „działający
 * jako:”) zamiast wplatać w zdanie wymagające odmiany — dzięki temu nie ma
 * ani automatycznej deklinacji, ani pól jej ręcznej korekty, ani zależności
 * od płci osoby.
 */
function reprezentantKlucze(spolka) {
  return {
    reprezentant_imie_nazwisko: spolka.reprezentant_imie_nazwisko || null,
    reprezentant_funkcja: spolka.reprezentant_funkcja || null,
    reprezentant_rodzice: spolka.reprezentant_rodzice || null,
    reprezentant_dowod: spolka.reprezentant_dowod || null,
    reprezentant_pesel: spolka.reprezentant_pesel || null,
    reprezentant_adres: spolka.reprezentant_adres || null,
    reprezentant_email: spolka.reprezentant_email || null,
    reprezentant_reprezentacja: spolka.reprezentant_reprezentacja || null,
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

// ─────────────────────────────────────────────────────────────
// Kontekst per wzór — wystawiane na żądanie (blok A5)
// ─────────────────────────────────────────────────────────────

/** `akcjonariusz_*` — sekcja `{{#akcjonariusze}}`, wspólna dla wzorów 03 i 08. */
function akcjonariuszeKlucze(akcjonariusze) {
  return (akcjonariusze || []).map((a, i) => ({
    akcjonariusz_lp: String(i + 1),
    akcjonariusz_nazwa: mianownik(a.osoba),
    akcjonariusz_seria: a.seria,
    akcjonariusz_liczba_akcji: String(a.ilosc),
    // Aplikacja nie prowadzi odrebnej wagi glosu na akcje (kazda niesie
    // jeden glos, chyba ze umowa spolki stanowi inaczej - art. 300(23) § 1
    // KSH - a to nie jest dzis modelowane) - liczba glosow rowna liczbie akcji.
    akcjonariusz_liczba_glosow: String(a.ilosc),
    akcjonariusz_obciazenia: opiszObciazenia(a.obciazenia),
  }));
}

/** `czlonek_*` — sekcja `{{#czlonkowie_organu}}` (wzór 08), z importu KRS (`psa_spolki.sklad_organu_json`). */
function czlonkowieOrganuKlucze(skladOrganu) {
  return (skladOrganu || []).map((o) => ({
    czlonek_mianownik: [o.imiona, o.nazwisko].filter(Boolean).join(' ') || null,
    czlonek_funkcja: o.funkcja || null,
  }));
}

/**
 * Wzór 01 — umowa o prowadzenie rejestru. Jednorazowy dokument sporządzany
 * przy rejestracji spółki — dane reprezentanta (blok B6) notariusz uzupełnia
 * raz, w kartotece spółki.
 *
 * `taksa_*` z konfiguracji stawek (`przepisy.STAWKI_GROSZE`) — te same liczby,
 * co przy naliczaniu opłat (`server/oplaty.js`), więc umowa i rachunek nigdy
 * nie rozjadą się kwotowo. Forma słowna (`taksa_roczna_slownie` itd.) NIE
 * jest tu wyliczana wprost — renderer sam ją wyprowadzi z wartości liczbowej
 * (`logika/docx.js`, mechanizm `{{klucz_slownie}}`).
 */
function umowaOProwadzenieRejestru({ spolka, dzis }) {
  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    ...reprezentantKlucze(spolka),
    umowa_data: dataPl(spolka.data_umowy || dzis),
    taksa_roczna: String(przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE / 100),
    taksa_wpis: String(przepisy.STAWKI_GROSZE.WPIS / 100),
    taksa_informacja: String(przepisy.STAWKI_GROSZE.INFORMACJA / 100),
  };
}

/** Wzór 02 — załącznik: informacja RODO. Podpisuje ten sam reprezentant, co umowę. */
function informacjaRodo() {
  return { ...kancelariaKlucze() };
}

/**
 * Wzór 03 — uchwała o wyborze notariusza. Dokumentuje głosowanie, które
 * zaszło POZA aplikacją (walne zgromadzenie/pisemne głosowanie akcjonariuszy)
 * — liczby głosów, numer i tryb głosowania nie mają dziś żadnego miejsca
 * w schemacie (to nie jest zdarzenie rejestrowe), więc wpisuje je notariusz
 * wprost przy wystawianiu tego jednorazowego dokumentu.
 */
function uchwalaWyboru({ spolka, akcjonariusze, uchwala, dzis }) {
  const u = uchwala || {};
  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    akcjonariusze: akcjonariuszeKlucze(akcjonariusze),
    uchwala_numer: u.numer || null,
    uchwala_data_slownie: u.dataSlownie || null,
    uchwala_tryb_glosowania: u.trybGlosowania || null,
    uchwala_glosy_za: u.glosyZa != null ? String(u.glosyZa) : null,
    uchwala_glosy_przeciw: u.glosyPrzeciw != null ? String(u.glosyPrzeciw) : null,
    uchwala_glosy_wstrzymujace: u.glosyWstrzymujace != null ? String(u.glosyWstrzymujace) : null,
    uchwala_procent_glosow: u.procentGlosow || null,
  };
}

/**
 * Wzór 08 — lista akcjonariuszy do sądu (art. 476 § 1(1) KSH, nowelizacja).
 * Dwa wyzwalacze: wykreślenie spółki z rejestru przedsiębiorców ORAZ
 * odpowiedź na zapytanie sądu (art. 25da ustawy o KRS). `czlonkowieOrganu`
 * z `psa_spolki.sklad_organu_json` (import z KRS) — podpisują listę.
 */
function listaAkcjonariuszyDoSadu({ spolka, akcjonariusze, razemAkcji, czlonkowieOrganu, adresatNazwa, adresatAdres, dzis }) {
  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    adresat_nazwa: adresatNazwa || sadRejestrowyPelny(spolka),
    adresat_adres: adresatAdres || null,
    pismo_data: dataPl(dzis),
    lista_stan_na_dzien: dataPl(dzis),
    lista_akcje_razem: razemAkcji != null ? String(razemAkcji) : null,
    akcjonariusze: akcjonariuszeKlucze(akcjonariusze),
    czlonkowie_organu: czlonkowieOrganuKlucze(czlonkowieOrganu),
  };
}

/**
 * Wzór 10 — klauzula do umowy zbycia akcji. Dołącza się do umowy zbywcy
 * i nabywcy poza aplikacją — treść klauzuli (`paragraf`/`pokrycie`/
 * `ograniczenia`) notariusz wpisuje przy wystawianiu, bo dotyczy KONKRETNEJ
 * transakcji, nie stanu rejestru.
 */
function klauzulaZbycia({ spolka, klauzula, zbywca, nabywca }) {
  const k = klauzula || {};
  return {
    spolka_firma: spolka.nazwa || null,
    spolka_krs: spolka.krs || null,
    spolka_siedziba_mianownik: spolka.miejscowosc || null,
    klauzula_paragraf: k.paragraf || null,
    klauzula_pokrycie: k.pokrycie || null,
    klauzula_ograniczenia: k.ograniczenia || null,
    zbywca_email: zbywca ? zbywca.email : null,
    nabywca_email: nabywca ? nabywca.email : null,
  };
}

/**
 * Wzór 04 — żądanie dokonania wpisu (art. 300(34) § 1 i § 4 KSH). Jedyny
 * z dziesięciu wzorów, który dokumentuje stronę ŻĄDAJĄCĄ wpisu, nie
 * kancelarię — wystawia się go dla KONKRETNEJ sprawy, z danych zapisanych
 * przy jej założeniu (`sprawa.zadajacy_osoba_id`, `dokument_rodzaj`/
 * `dokument_data` z bloku B3, załączniki z `psa_dokumenty`).
 *
 * Sekcja IV („Zgoda na dokonanie wpisu") dotyczy tylko wpisów, które
 * wykreślają, zmieniają albo obciążają uprawnienia INNEJ osoby — aplikacja
 * nie ma dziś pola „kto wyraża zgodę" w schemacie sprawy (`zgoda_forma`/
 * `zgoda_data` zapisują tylko ŻE i JAK zgoda wpłynęła, nie OD KOGO), więc
 * notariusz wskazuje tę osobę wprost przy wystawianiu — tak jak zbywcę
 * i nabywcę przy klauzuli zbycia (wzór 10, blok A5).
 */
function zadanieWpisu({ spolka, sprawa, zadajacy, osoby, dokumenty, zgadzajacy, dzis }) {
  return {
    ...kancelariaKlucze(),
    ...spolkaKlucze(spolka),
    zadanie_data: dataPl(dzis),
    zadajacy_mianownik: mianownik(zadajacy),
    zadajacy_identyfikator: identyfikatorWewnetrzny(zadajacy),
    zadajacy_adres: adresZamieszkaniaPelny(zadajacy),
    zadajacy_adres_doreczen: zadajacy ? zadajacy.adres_doreczen || adresZamieszkaniaPelny(zadajacy) : null,
    zadajacy_email: zadajacy ? zadajacy.email || null : null,
    zadajacy_rola: sprawa.zadajacy_rola ? przepisy.OPISY_ROL_ZADAJACEGO[sprawa.zadajacy_rola] : null,
    sposob_doreczen: zadajacy && zadajacy.email
      ? `na adres poczty elektronicznej ${zadajacy.email}`
      : 'listownie na adres do doręczeń',
    // psa_osoby.zgoda_email jest bool (zgoda na komunikacje mailowa i na
    // ujawnienie adresu w rejestrze) - wzor cytuje to jako zdanie, nie liczbe.
    zgoda_email: zadajacy ? (zadajacy.zgoda_email ? 'Wyrażam zgodę' : 'Nie wyrażam zgody') : null,
    wpis_opis: wpisOpisZDraftu(sprawa, osoby),
    dokument_rodzaj: sprawa.dokument_rodzaj ? przepisy.OPISY_RODZAJOW_DOKUMENTU[sprawa.dokument_rodzaj] : null,
    dokument_data: dataPl(sprawa.dokument_data),
    podstawa_dokument: sprawa.dokument_rodzaj ? [{}] : [],
    zalaczniki: (dokumenty || []).map((d) => ({
      zalacznik_opis: `${przepisy.OPISY_RODZAJOW_DOKUMENTU[d.typ_dokumentu] || 'inny dokument'} (${d.nazwa_pliku})`,
    })),
    zgadzajacy_mianownik: zgadzajacy ? mianownik(zgadzajacy) : null,
    zgadzajacy_identyfikator: zgadzajacy ? identyfikatorWewnetrzny(zgadzajacy) : null,
    zgoda: zgadzajacy ? [{}] : [],
  };
}

module.exports = {
  dataPl,
  godzina,
  mianownik,
  adresPelny,
  adresZamieszkaniaPelny,
  identyfikatorWewnetrzny,
  sadRejestrowyPelny,
  kancelariaKlucze,
  spolkaKlucze,
  reprezentantKlucze,
  pismoKlucze,
  pozycjeKlucze,
  akcjonariuszeKlucze,
  czlonkowieOrganuKlucze,
  zawiadomienieWpisu,
  zawiadomienieNiedokonania,
  wezwanieDoUzupelnienia,
  powiadomienieUprzednie,
  umowaOProwadzenieRejestru,
  informacjaRodo,
  uchwalaWyboru,
  listaAkcjonariuszyDoSadu,
  klauzulaZbycia,
  zadanieWpisu,
};
