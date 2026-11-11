'use strict';

/**
 * Pisma wychodzące — jeden moduł (§ 4). Pismo powstaje wyłącznie z czynności (krok sprawy, wpis,
 * odmowa, wstrzymanie, zamówienie informacji, wniosek); wysyła je pracownik po podglądzie (U-09).
 *
 * Przy utworzeniu pismo dostaje numer i pełną treść (migawka pól wzoru) — późniejsza zmiana danych
 * osoby, spółki czy kancelarii go nie zmienia. PDF powstaje raz, przy pierwszym podglądzie,
 * pobraniu albo wysyłce, z tej migawki; skrót SHA-256 zapisuje się w `psa_pisma`.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const danePisma = require('../dane/pisma');
const daneOsoby = require('../dane/osoby');
const daneSpolki = require('../dane/spolki');
const daneSprawy = require('../dane/sprawy');
const n = require('./numery');
const stanLogika = require('./stan');
const terminy = require('./terminy');
const ustawienia = require('./ustawienia');
const wzory = require('./wzory');
const { BladWalidacji } = require('./walidacje');

const TYPY = {
  umowa: 'Umowa o prowadzenie rejestru akcjonariuszy',
  uchwala: 'Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr',
  zgoda_email: 'Zgoda na korespondencję e-mail',
  powiadomienie_zamierzony: 'Powiadomienie o zamierzonym wpisie',
  powiadomienie_wpis: 'Powiadomienie o wpisie',
  powiadomienie_odmowa: 'Powiadomienie o odmowie',
  wezwanie: 'Wezwanie do uzupełnienia',
  informacja: 'Informacja z rejestru akcjonariuszy',
};

/** Pisma z datą i miejscem w nagłówku (listy); informacja ma własny nagłówek (znak, kancelaria). */
const LISTY = new Set(['powiadomienie_zamierzony', 'powiadomienie_wpis', 'powiadomienie_odmowa', 'wezwanie']);

/** Plik wzoru w `wzory/` dla typu pisma. */
const nazwaWzoru = (typ) => typ.replace(/_/g, '-');

const PRZEJSCIA = {
  do_wyslania: ['wyslane', 'blad'],
  blad: ['wyslane', 'blad'],
  wyslane: [],
};

// ─────────────────────────────────────────────────────────────
// Treść: opis zmian, stan rejestru, dane stron
// ─────────────────────────────────────────────────────────────

const dataPl = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : null);

function akcjiSlowo(liczba) {
  const l = Number(liczba);
  if (l === 1) return 'akcja';
  const d = l % 10;
  const s = l % 100;
  return d >= 2 && d <= 4 && (s < 12 || s > 14) ? 'akcje' : 'akcji';
}

const RODZAJ_OBCIAZENIA = { zastaw: 'zastaw', uzytkowanie: 'użytkowanie', zajecie: 'zajęcie' };
const RODZAJ_ADNOTACJI = {
  uprawnienie: 'uprawnienie szczególne',
  ograniczenie: 'ograniczenie rozporządzania',
  obowiazek: 'obowiązek wobec spółki',
  niepokryte: 'akcje niepokryte w całości',
  inna: 'informacja o akcjach',
};
const POWOD_ZAMKNIECIA = {
  przekazanie: 'przekazanie rejestru innemu podmiotowi',
  wykreslenie_spolki: 'wykreślenie spółki z rejestru przedsiębiorców',
  rozwiazanie_umowy: 'rozwiązanie umowy',
};

/** Numery z operacji — postać ze sprawy („1-10”) albo po sprawdzeniu (zakresy). */
function numery(a) {
  if (a.zakresy) return n.opisz(a.zakresy);
  if (a.nr_od != null) return n.opisz([{ nr_od: a.nr_od, nr_do: a.nr_do }]);
  return String(a.numery || '').replace(/-/g, '–');
}

function liczbaAkcji(a) {
  if (a.czesc) return `${a.czesc.licznik}/${a.czesc.mianownik} akcji`;
  if (a.ulamek) return `${a.ulamek} akcji`;
  return `${a.liczba} ${akcjiSlowo(a.liczba)}`;
}

const opisAkcji = (lista) => (lista || []).map((a) => `seria ${a.seria} nr ${numery(a)} (${liczbaAkcji(a)})`).join('; ');

function nazwaOsoby(db, id) {
  const o = daneOsoby.wczytaj(db, id);
  return o ? o.nazwa : `osoba nr ${id}`;
}

function opisOperacji(db, op) {
  const kto = (id) => nazwaOsoby(db, id);
  switch (op.typ) {
    case 'otwarcie':
      return `Otwarcie rejestru akcjonariuszy${op.zrodlo === 'przejecie' ? ' (przejęcie od dotychczasowego podmiotu)' : ''}: ${opisAkcji(op.serie)}.`;
    case 'emisja':
      return (
        `Emisja akcji serii ${op.seria} nr ${numery(op)} (${liczbaAkcji(op)}), wpisana do rejestru przedsiębiorców ${dataPl(op.data_wpisu_krs)}; ` +
        `obejmujący: ${(op.obejmujacy || []).map((o) => `${kto(o.osoba_id)} — nr ${numery(o)} (${liczbaAkcji(o)})`).join('; ')}` +
        `${op.pokryte === false ? '; akcje nie są pokryte w całości' : ''}.`
      );
    case 'przeniesienie':
      return (op.nabywcy || []).map((nb) => `Przeniesienie akcji z ${kto(op.zbywca_osoba_id)} na ${kto(nb.osoba_id)}: ${opisAkcji(nb.akcje)}.`).join(' ');
    case 'umorzenie':
      return `Umorzenie akcji: ${opisAkcji(op.akcje)}; podstawa: ${op.podstawa === 'orzeczenie' ? 'orzeczenie sądu' : 'uchwała'}.`;
    case 'obciazenie': {
      const akcje = op.akcje && op.akcje.length ? ` akcji ${opisAkcji(op.akcje)}` : '';
      if (op.operacja === 'ustanowienie') {
        return (
          `Ustanowienie: ${RODZAJ_OBCIAZENIA[op.rodzaj] || op.rodzaj} na${akcje.replace(' akcji', ' akcjach')}` +
          `${op.osoba_id ? ` na rzecz ${kto(op.osoba_id)}` : ''}${op.prawo_glosu ? ', z prawem głosu' : ''}${op.tresc ? ` (${op.tresc})` : ''}.`
        );
      }
      if (op.operacja === 'zmiana_prawa_glosu') {
        return `Zmiana prawa głosu z obciążonych${akcje}: prawo głosu wykonuje ${op.prawo_glosu ? 'uprawniony z obciążenia' : 'akcjonariusz'}.`;
      }
      return `Wykreślenie obciążenia${akcje}.`;
    }
    case 'adnotacja': {
      const rodzaj = RODZAJ_ADNOTACJI[op.rodzaj] || 'informacja o akcjach';
      if (op.operacja === 'wykreslenie') return `Wykreślenie: ${rodzaj} — akcje ${opisAkcji(op.akcje)}.`;
      return `Wpis: ${rodzaj} — akcje ${opisAkcji(op.akcje)}${op.tresc ? `: ${op.tresc}` : ''}.`;
    }
    case 'sprostowanie':
      return `Sprostowanie wpisu nr ${op.zdarzenie_id}: ${op.tryb === 'wycofaj' ? 'wycofanie wpisu' : 'zastąpienie treści wpisu'}.`;
    case 'zamkniecie':
      return `Zamknięcie rejestru (${POWOD_ZAMKNIECIA[op.powod] || op.powod}).`;
    default:
      return op.typ;
  }
}

const OBCIAZENIA = new Set(Object.keys(RODZAJ_OBCIAZENIA));

/** Tabela stanu rejestru (akcjonariusz · seria · numery · liczba · obciążenia). */
function pozycje(db, stan) {
  const w = stanLogika.widok(stan);
  const obc = w.atrybuty.filter((a) => OBCIAZENIA.has(a.rodzaj));
  return w.akcjonariusze.map((p) => ({
    akcjonariusz: nazwaOsoby(db, p.osoba_id),
    seria: p.seria,
    numery: n.opisz(p.zakresy),
    liczba: p.czesc ? `${p.czesc.licznik}/${p.czesc.mianownik}` : String(p.liczba),
    obciazenia: obc
      .filter((a) => a.seria === p.seria && n.nakladaja(a.zakresy, p.zakresy))
      .map((a) => `${RODZAJ_OBCIAZENIA[a.rodzaj]}${a.prawo_glosu ? ' (prawo głosu)' : ''}`)
      .join(', '),
  }));
}

/** Projekt listy akcjonariuszy do KRS (art. 300³⁴ § 8): akcjonariusz, seria, liczba, wzmianka. */
function listaDoKrs(db, stan) {
  const w = stanLogika.widok(stan);
  const grupy = new Map();
  for (const p of w.akcjonariusze) {
    const k = `${p.osoba_id}|${p.seria}`;
    if (!grupy.has(k)) grupy.set(k, { osoba_id: p.osoba_id, seria: p.seria, liczba: 0, ulamki: [], zakresy: [] });
    const g = grupy.get(k);
    if (p.czesc) g.ulamki.push(`${p.czesc.licznik}/${p.czesc.mianownik}`);
    else g.liczba += p.liczba;
    g.zakresy.push(...p.zakresy);
  }
  const obc = w.atrybuty.filter((a) => a.rodzaj === 'zastaw' || a.rodzaj === 'uzytkowanie');
  const wiersze = [...grupy.values()].map((g, i) => ({
    lp: String(i + 1),
    nazwa: nazwaOsoby(db, g.osoba_id),
    seria: g.seria,
    liczba: [g.liczba ? String(g.liczba) : null, ...g.ulamki].filter(Boolean).join(' + '),
    wzmianka: [...new Set(obc.filter((a) => a.seria === g.seria && n.nakladaja(a.zakresy, g.zakresy)).map((a) => RODZAJ_OBCIAZENIA[a.rodzaj]))].join(', '),
  }));
  const razem = w.serie.reduce((s, e) => s + e.liczba - n.ilosc(e.umorzone), 0);
  return { lista_akcjonariuszy: wiersze, akcje_razem: String(razem) };
}

function kancelaria(db) {
  const k = ustawienia.kancelaria(db);
  const braki = [
    ['notariusz_mianownik', 'notariusz'],
    ['kancelaria_ulica', 'ulica'],
    ['kancelaria_kod', 'kod pocztowy'],
    ['kancelaria_miasto', 'miejscowość'],
  ]
    .filter(([klucz]) => !k[klucz])
    .map(([, etykieta]) => etykieta);
  if (braki.length > 0) throw new BladWalidacji([`Uzupełnij dane kancelarii w Ustawieniach: ${braki.join(', ')}.`]);
  return {
    notariusz: k.notariusz_mianownik,
    kancelaria_adres: `${k.kancelaria_ulica}, ${k.kancelaria_kod} ${k.kancelaria_miasto}`,
    kancelaria_miasto: k.kancelaria_miasto,
    kancelaria_nip: k.kancelaria_nip || null,
    kancelaria_regon: k.kancelaria_regon || null,
    kancelaria_email: k.email || null,
    kancelaria_telefon: k.telefon || null,
    podpisujacy: k.podpisujacy_mianownik || k.notariusz_mianownik,
    podpisujacy_funkcja: k.podpisujacy_funkcja || 'notariusz',
  };
}

function spolka(db, id) {
  const s = daneSpolki.wczytaj(db, id);
  if (!s) return {};
  return {
    spolka_firma: s.nazwa,
    spolka_siedziba: s.siedziba,
    spolka_adres: s.adres,
    spolka_sad: s.sad_rejestrowy,
    spolka_krs: s.krs,
    spolka_nip: s.nip || null,
    spolka_email: s.email || null,
    spolka_data_rejestracji: dataPl(s.data_rejestracji),
  };
}

function adresat(db, p, s) {
  if (p.adresat === 'osoba') {
    const o = daneOsoby.wczytaj(db, p.adresat_osoba_id);
    return { adresat_nazwa: o.nazwa, adresat_adres: o.adres, adresat_spolka: false };
  }
  if (p.adresat === 'spolka') return { adresat_nazwa: s.spolka_firma, adresat_adres: s.spolka_adres, adresat_spolka: true };
  if (p.adresat === 'organ') return { adresat_nazwa: p.adresat_opis, adresat_adres: '', adresat_spolka: false };
  return { adresat_spolka: false };
}

function sprawa(db, id, operacje) {
  const s = daneSprawy.wczytaj(db, id);
  let zadajacy = null;
  if (s.zadajacy === 'osoba') zadajacy = nazwaOsoby(db, s.zadajacy_osoba_id);
  else if (s.zadajacy === 'spolka') zadajacy = daneSpolki.wczytaj(db, s.spolka_id).nazwa;
  else if (s.zadajacy === 'organ') zadajacy = s.zadajacy_opis;
  const termin = terminy.policzTermin(s, czas.dzisIso()).termin_do || terminy.dodajDni(s.wznowiona_od || s.data_wplywu, 7);
  return {
    sprawa_znak: String(s.id),
    data_wplywu: dataPl(s.data_wplywu),
    zadajacy,
    podstawa: s.podstawa || null,
    podstawa_data: dataPl(s.podstawa_data),
    termin: dataPl(termin),
    zmiany: (operacje || s.operacje || []).map((op) => ({ opis: opisOperacji(db, op) })),
  };
}

/**
 * Migawka pól wzoru. `p.dane` — wejście z czynności (stan po wpisie, operacje, chwila wpisu),
 * `p.kontekst` — pola podane wprost (treść wezwania, przyczyna odmowy, informacja, wniosek).
 */
function kontekst(db, typ, p) {
  const d = p.dane || {};
  const s = p.spolka_id ? spolka(db, p.spolka_id) : {};
  const k = { ...kancelaria(db), data: dataPl(czas.dzisIso()), ...s, ...adresat(db, p, s) };
  if (p.sprawa_id) Object.assign(k, sprawa(db, p.sprawa_id, d.operacje));
  if (d.stanPo) k.pozycje = pozycje(db, d.stanPo);
  if (typ === 'powiadomienie_wpis') {
    k.wpis_data = dataPl(czas.dzienLokalny(d.chwila));
    k.wpis_godzina = czas.godzinaLokalna(d.chwila);
    if (p.adresat === 'spolka') Object.assign(k, listaDoKrs(db, d.stanPo));
  }
  if (typ === 'powiadomienie_odmowa') k.odmowa_umowy = Boolean(p.wniosek_id);
  return { ...k, ...(p.kontekst || {}) };
}

// ─────────────────────────────────────────────────────────────
// Kanał, utworzenie, PDF
// ─────────────────────────────────────────────────────────────

/**
 * R9: e-mail z PDF, gdy adresat ma zgodę na korespondencję e-mail (spółka — z umowy, czyli gdy
 * podała adres); w każdym innym przypadku list. Organ i wnioskodawca (odmowa zawarcia umowy —
 * art. 108a PrNot) — zawsze list.
 */
function kanal(db, { adresat: rodzaj, adresat_osoba_id: osobaId, spolka_id: spolkaId }) {
  if (rodzaj === 'osoba') {
    const o = daneOsoby.wczytaj(db, osobaId);
    return o && o.zgoda_email && o.email ? 'email' : 'list';
  }
  if (rodzaj === 'spolka') {
    const s = daneSpolki.wczytaj(db, spolkaId);
    return s && s.email ? 'email' : 'list';
  }
  return 'list';
}

function utworz(db, typ, p) {
  if (!TYPY[typ]) throw new Error(`Nieznany typ pisma „${typ}”.`);
  const numer = danePisma.nastepnyNumer(db, `${typ === 'informacja' ? 'INF' : 'PSA'}/${czas.dzisIso().slice(0, 4)}/`);
  const k = { ...kontekst(db, typ, p), numer };
  const { brakujace } = wzory.wypelnij(wzory.wczytaj(nazwaWzoru(typ)), k);
  if (brakujace.length > 0) throw new BladWalidacji([`${TYPY[typ]}: brak danych (${brakujace.join(', ')}).`]);
  return danePisma.dodaj(db, { ...p, typ, numer, kanal: p.kanal || kanal(db, p), kontekst: k });
}

function wczytaj(db, id) {
  const p = danePisma.wczytaj(db, id);
  if (!p) throw new BladWalidacji(['Nie odnaleziono pisma.']);
  return p;
}

/** Treść pisma jako tekst (bez układu). */
function tekst(db, id) {
  const p = wczytaj(db, id);
  return wzory.tekst(wzory.wypelnij(wzory.wczytaj(nazwaWzoru(p.typ)), p.kontekst).bloki);
}

/** PDF z pól wzoru — wspólny wygląd pism z nagłówkiem kancelarii w listach; informacja — własny wygląd. */
function renderuj(typ, k, numer) {
  const { bloki } = wzory.wypelnij(wzory.wczytaj(nazwaWzoru(typ)), k);
  const autor = `Kancelaria Notarialna, notariusz: ${k.notariusz}`;
  if (typ === 'informacja') {
    const naglowek = {
      nazwa: 'Kancelaria Notarialna',
      rola: 'podmiot prowadzący rejestr akcjonariuszy',
      linie: [
        `notariusz ${k.notariusz}`,
        k.kancelaria_adres,
        [k.kancelaria_email, k.kancelaria_telefon && `tel. ${k.kancelaria_telefon}`].filter(Boolean).join(' · '),
      ].filter(Boolean),
    };
    return wzory.pdf(bloki, { numer, naglowek, tytul: TYPY[typ], autor, wyglad: 'informacja' });
  }
  const naglowek =
    LISTY.has(typ)
      ? {
          lewy: [
            `Kancelaria Notarialna, notariusz: ${k.notariusz}`,
            k.kancelaria_adres,
            [k.kancelaria_email, k.kancelaria_telefon && `tel. ${k.kancelaria_telefon}`].filter(Boolean).join(', '),
            'podmiot prowadzący rejestr akcjonariuszy',
          ].filter(Boolean),
          prawy: `${k.kancelaria_miasto}, dnia ${k.data} r.`,
        }
      : null;
  return wzory.pdf(bloki, { numer, naglowek, tytul: TYPY[typ], autor });
}

/** PDF pisma — powstaje raz; kolejne wywołania zwracają ten sam plik. */
async function pdf(db, id) {
  const p = wczytaj(db, id);
  const katalog = konfiguracja.KATALOG_DOKUMENTOW;
  if (p.plik && fs.existsSync(path.join(katalog, path.basename(p.plik)))) return fs.readFileSync(path.join(katalog, path.basename(p.plik)));
  const { bufor } = await renderuj(p.typ, p.kontekst, p.numer);
  const nazwa = `pismo-${crypto.randomUUID()}.pdf`;
  fs.mkdirSync(katalog, { recursive: true });
  fs.writeFileSync(path.join(katalog, nazwa), bufor, { flag: 'wx' });
  if (!danePisma.zapiszPlik(db, id, nazwa, crypto.createHash('sha256').update(bufor).digest('hex'), p.plik)) {
    fs.rmSync(path.join(katalog, nazwa));
    return pdf(db, id);
  }
  return bufor;
}

function zmienStan(db, id, na, { wyslano = null, idWiadomosci = null, odpowiedzSerwera = null } = {}) {
  const p = wczytaj(db, id);
  if (!PRZEJSCIA[p.stan].includes(na)) {
    throw new BladWalidacji([`Pismo w stanie „${p.stan}” nie może przejść do stanu „${na}”.`]);
  }
  danePisma.ustawStan(db, id, na, { wyslano: na === 'wyslane' ? wyslano || czas.terazIso() : null, idWiadomosci, odpowiedzSerwera });
  return danePisma.wczytaj(db, id);
}

/** U-28: list — „Nadano” zapisuje dzisiejszą datę. */
function nadano(db, id) {
  const p = wczytaj(db, id);
  if (p.kanal !== 'list') throw new BladWalidacji(['„Nadano” dotyczy wyłącznie listów.']);
  return zmienStan(db, id, 'wyslane', { wyslano: czas.dzisIso() });
}

/** Usuwa niewysłane pisma, które przestały być potrzebne — razem z ich plikami PDF. */
function usunNiewyslane(db, warunek) {
  for (const plik of danePisma.usunNiewyslane(db, warunek)) {
    fs.rmSync(path.join(konfiguracja.KATALOG_DOKUMENTOW, path.basename(plik)), { force: true });
  }
}

/** Ważne (wysłane, nieunieważnione) powiadomienie o zamierzonym wpisie do osoby w sprawie. */
function powiadomienieWyslane(db, sprawaId, osobaId) {
  return danePisma
    .lista(db, { sprawaId })
    .some(
      (p) => p.typ === 'powiadomienie_zamierzony' && p.adresat_osoba_id === Number(osobaId) && p.stan === 'wyslane' && !p.uniewaznione
    );
}

module.exports = {
  TYPY,
  PRZEJSCIA,
  nazwaWzoru,
  dataPl,
  kanal,
  kontekst,
  utworz,
  wczytaj,
  tekst,
  renderuj,
  pdf,
  zmienStan,
  nadano,
  powiadomienieWyslane,
  usunNiewyslane,
  uniewaznijWyslane: danePisma.uniewaznijWyslane,
  lista: danePisma.lista,
};
