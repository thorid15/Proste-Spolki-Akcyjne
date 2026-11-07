'use strict';

/**
 * Walidacja treści sprawy — moduł czysty.
 *
 * 1. `przygotuj` — robocza operacja (seria, numery i liczba wpisane ręcznie — U-26) → treść wpisu;
 *    niezgodności formatu to błędy przy polach (R8), nie blokady prawne.
 * 2. `sprawdzSklad` — co wolno połączyć w jednej sprawie (R3: zajęcie tylko z urzędu).
 * 3. `sprawdzBlokady` — blokady systemowe R6 niezależne od odtworzenia stanu: rejestr zamknięty,
 *    data wpisu emisji do KRS (art. 300(30) § 2 KSH, reguła Z-012), nieprawidłowy PESEL (U-18).
 *    Bilans i rozporządzenie ponad stan posiadania sprawdza odtworzenie stanu (`rejestr.js`),
 *    powiadomienia i checklistę — `rejestr.wpisz`.
 */

const n = require('./numery');
const u = require('./ulamki');
const typy = require('./typy-zdarzen');
const osobyLogika = require('./osoby');
const czas = require('../pomocnicze/czas');

class BladWalidacji extends Error {
  constructor(bledy) {
    const lista = (bledy || []).map((b) => (typeof b === 'string' ? { komunikat: b } : b));
    super(lista.map((b) => b.komunikat).join(' '));
    this.name = 'BladWalidacji';
    this.bledy = lista;
  }
}

const TYLKO_SAMODZIELNE = ['otwarcie', 'sprostowanie', 'zamkniecie'];
const RODZAJE_ATRYBUTOW = [...typy.RODZAJE_OBCIAZENIA, ...typy.RODZAJE_ADNOTACJI];

function tekst(v) {
  return v == null ? '' : String(v).trim();
}

/**
 * Walidator jednej roboczej operacji. `k` = { osoba(id) → wiersz|null, zdarzenie(id) → wiersz|null,
 * stan (odtworzony stan spółki) }.
 */
function walidator(k, bledy) {
  const blad = (pole, komunikat) => bledy.push({ pole, komunikat });

  const lista = (v, pole, komunikat) => {
    if (!Array.isArray(v) || v.length === 0) {
      blad(pole, komunikat);
      return [];
    }
    return v;
  };
  const wybor = (v, dozwolone, pole, komunikat) => {
    if (!dozwolone.includes(v)) blad(pole, komunikat);
    return v;
  };
  const takNie = (v, pole, komunikat) => {
    if (v !== true && v !== false) blad(pole, komunikat);
    return v;
  };
  const osoba = (v, pole) => {
    const id = Number(v);
    if (!Number.isInteger(id) || id < 1) {
      blad(pole, 'Wskaż osobę z kartoteki.');
      return null;
    }
    const o = k.osoba(id);
    if (!o) blad(pole, `Nie ma w kartotece osoby #${id}.`);
    else if (o.typ === 'fizyczna' && o.pesel && !osobyLogika.poprawnyPesel(o.pesel)) {
      blad(pole, `Osoba „${o.nazwa}” ma nieprawidłowy PESEL — popraw dane w kartotece.`);
    }
    return id;
  };
  const data = (v, pole, komunikat) => {
    if (!czas.poprawnaData(v)) blad(pole, komunikat);
    return v || null;
  };

  /** Seria, numery i liczba (U-26); `ulamek` dopuszcza część jednego numeru. */
  const akcje = (a, pole, { ulamek = false, seria = null } = {}) => {
    const w = { seria: seria ?? tekst(a && a.seria), zakresy: [], liczba: null };
    if (!w.seria) blad(`${pole}.seria`, 'Podaj serię akcji.');
    try {
      w.zakresy = n.parsuj(a && a.numery);
      if (w.zakresy.length === 0) blad(`${pole}.numery`, 'Podaj numery akcji.');
    } catch (e) {
      blad(`${pole}.numery`, e.message);
    }
    const liczba = Number(a && a.liczba);
    if (!Number.isInteger(liczba) || liczba < 1) {
      blad(`${pole}.liczba`, 'Podaj liczbę akcji.');
    } else if (w.zakresy.length > 0 && n.ilosc(w.zakresy) !== liczba) {
      blad(`${pole}.liczba`, `Liczba akcji (${liczba}) nie zgadza się z numerami ${n.opisz(w.zakresy)} (${n.ilosc(w.zakresy)} akcji).`);
    }
    w.liczba = liczba;
    if (ulamek && tekst(a.ulamek)) {
      const m = tekst(a.ulamek).match(/^(\d+)\s*\/\s*(\d+)$/);
      let cz = null;
      try {
        cz = m ? u.waliduj({ licznik: Number(m[1]), mianownik: Number(m[2]) }) : null;
      } catch {
        cz = null;
      }
      if (!cz) blad(`${pole}.ulamek`, 'Podaj ułamek w postaci „1/2”.');
      else if (!u.jestJeden(cz)) {
        if (liczba !== 1) blad(`${pole}.ulamek`, 'Ułamek dotyczy dokładnie jednej akcji (jednego numeru).');
        w.czesc = { licznik: cz.licznik, mianownik: cz.mianownik };
      }
    }
    return w;
  };

  const listaAkcji = (v, pole, opcje) =>
    lista(v, pole, 'Wskaż akcje: serię, numery i liczbę.').map((a, i) => akcje(a, `${pole}.${i}`, opcje));

  const seriaCiagla = (s, pole) => {
    const a = akcje(s, pole);
    if (a.zakresy.length > 1) blad(`${pole}.numery`, 'Numery serii muszą tworzyć jeden ciągły zakres.');
    const z = a.zakresy[0] || { nr_od: null, nr_do: null };
    return { seria: a.seria, nr_od: z.nr_od, nr_do: z.nr_do, liczba: a.liczba };
  };

  /**
   * Atrybut wskazany do zmiany albo wykreślenia — rodzaj wynika ze stanu (także atrybutu już
   * wykreślonego: sprostowanie zastępuje wpis w jego miejscu w chronologii). Czy atrybut jest
   * otwarty na wskazanych akcjach, sprawdza odtworzenie stanu.
   */
  const atrybut = (ref, pole, rodzajeDozwolone) => {
    const zid = Number(ref && ref.zdarzenie_id);
    const poz = Number((ref && ref.pozycja) || 0);
    const wiersz = k.stan && k.stan.atrybuty.find((a) => a.zdarzenie_id === zid && a.pozycja === poz);
    if (!wiersz) {
      blad(pole, 'Wskaż obciążenie albo adnotację, której dotyczy zmiana.');
      return { ref: { zdarzenie_id: zid, pozycja: poz }, rodzaj: null };
    }
    if (!rodzajeDozwolone.includes(wiersz.rodzaj)) blad(pole, 'Wskazany wpis jest innego rodzaju.');
    return { ref: { zdarzenie_id: zid, pozycja: poz }, rodzaj: wiersz.rodzaj };
  };

  const PRZYGOTUJ = {
    otwarcie(r, p) {
      const serie = lista(r.serie, `${p}.serie`, 'Podaj co najmniej jedną serię akcji.').map((s, i) => ({
        ...seriaCiagla(s, `${p}.serie.${i}`),
        data_wpisu_krs: data(s.data_wpisu_krs, `${p}.serie.${i}.data_wpisu_krs`, 'Podaj datę wpisu emisji do KRS.'),
      }));
      return {
        typ: 'otwarcie',
        zrodlo: wybor(r.zrodlo, typy.ZRODLA_OTWARCIA, `${p}.zrodlo`, 'Wskaż: założenie spółki albo przejęcie rejestru.'),
        serie,
        akcjonariusze: lista(r.akcjonariusze, `${p}.akcjonariusze`, 'Podaj akcjonariuszy.').map((a, i) => ({
          osoba_id: osoba(a.osoba_id, `${p}.akcjonariusze.${i}.osoba_id`),
          akcje: listaAkcji(a.akcje, `${p}.akcjonariusze.${i}.akcje`, { ulamek: true }),
        })),
        umorzone: (r.umorzone || []).map((m, i) => ({
          ...akcje(m, `${p}.umorzone.${i}`),
          podstawa: wybor(m.podstawa, typy.PODSTAWY_UMORZENIA, `${p}.umorzone.${i}.podstawa`, 'Wskaż podstawę umorzenia.'),
        })),
        atrybuty: (r.atrybuty || []).map((t, i) => {
          const q = `${p}.atrybuty.${i}`;
          const rodzaj = wybor(t.rodzaj, RODZAJE_ATRYBUTOW, `${q}.rodzaj`, 'Wybierz rodzaj obciążenia albo adnotacji.');
          return {
            rodzaj,
            akcje: listaAkcji(t.akcje, `${q}.akcje`),
            osoba_id: ['zastaw', 'uzytkowanie'].includes(rodzaj) ? osoba(t.osoba_id, `${q}.osoba_id`) : null,
            tresc: tekst(t.tresc) || null,
            prawo_glosu: ['zastaw', 'uzytkowanie'].includes(rodzaj) && t.prawo_glosu === true,
          };
        }),
      };
    },

    emisja(r, p) {
      const s = seriaCiagla(r, p);
      return {
        typ: 'emisja',
        ...s,
        data_wpisu_krs: data(r.data_wpisu_krs, `${p}.data_wpisu_krs`, 'Podaj datę wpisu emisji do KRS.'),
        pokryte: takNie(r.pokryte, `${p}.pokryte`, 'Odpowiedz: czy akcje są pokryte w całości (tak albo nie).'),
        obejmujacy: lista(r.obejmujacy, `${p}.obejmujacy`, 'Podaj obejmujących akcje.').map((o, i) => {
          const a = akcje(o, `${p}.obejmujacy.${i}`, { seria: s.seria });
          return { osoba_id: osoba(o.osoba_id, `${p}.obejmujacy.${i}.osoba_id`), zakresy: a.zakresy, liczba: a.liczba };
        }),
      };
    },

    przeniesienie(r, p) {
      return {
        typ: 'przeniesienie',
        zbywca_osoba_id: osoba(r.zbywca_osoba_id, `${p}.zbywca_osoba_id`),
        nabywcy: lista(r.nabywcy, `${p}.nabywcy`, 'Podaj nabywcę.').map((x, i) => ({
          osoba_id: osoba(x.osoba_id, `${p}.nabywcy.${i}.osoba_id`),
          akcje: listaAkcji(x.akcje, `${p}.nabywcy.${i}.akcje`, { ulamek: true }),
        })),
      };
    },

    umorzenie(r, p) {
      return {
        typ: 'umorzenie',
        podstawa: wybor(r.podstawa, typy.PODSTAWY_UMORZENIA, `${p}.podstawa`, 'Wskaż podstawę: uchwała albo orzeczenie sądu.'),
        akcje: listaAkcji(r.akcje, `${p}.akcje`),
      };
    },

    obciazenie(r, p) {
      const operacja = wybor(r.operacja, typy.OPERACJE_OBCIAZENIA, `${p}.operacja`, 'Wybierz: ustanowienie, zmiana prawa głosu albo wykreślenie.');
      const op = { typ: 'obciazenie', operacja, akcje: listaAkcji(r.akcje, `${p}.akcje`) };
      if (operacja === 'ustanowienie') {
        op.rodzaj = wybor(r.rodzaj, typy.RODZAJE_OBCIAZENIA, `${p}.rodzaj`, 'Wybierz: zastaw, użytkowanie albo zajęcie.');
        op.osoba_id = op.rodzaj === 'zajecie' ? null : osoba(r.osoba_id, `${p}.osoba_id`);
        op.tresc = tekst(r.tresc) || null;
        op.prawo_glosu = op.rodzaj !== 'zajecie' && r.prawo_glosu === true;
      } else if (operacja) {
        const a = atrybut(r.atrybut, `${p}.atrybut`, typy.RODZAJE_OBCIAZENIA);
        op.atrybut = a.ref;
        op.rodzaj = a.rodzaj;
        if (operacja === 'zmiana_prawa_glosu') {
          if (a.rodzaj === 'zajecie') blad(`${p}.atrybut`, 'Zajęcie nie daje prawa głosu.');
          op.prawo_glosu = takNie(r.prawo_glosu, `${p}.prawo_glosu`, 'Wskaż: prawo głosu tak albo nie.');
        }
      }
      return op;
    },

    adnotacja(r, p) {
      const operacja = wybor(r.operacja, typy.OPERACJE_ADNOTACJI, `${p}.operacja`, 'Wybierz: dodanie albo wykreślenie.');
      const op = { typ: 'adnotacja', operacja, akcje: listaAkcji(r.akcje, `${p}.akcje`) };
      if (operacja === 'dodanie') {
        op.rodzaj = wybor(r.rodzaj, typy.RODZAJE_ADNOTACJI, `${p}.rodzaj`, 'Wybierz rodzaj informacji o akcjach.');
        op.tresc = tekst(r.tresc) || null;
        if (!op.tresc && op.rodzaj !== 'niepokryte') blad(`${p}.tresc`, 'Podaj treść.');
      } else if (operacja) {
        const a = atrybut(r.atrybut, `${p}.atrybut`, typy.RODZAJE_ADNOTACJI);
        op.atrybut = a.ref;
        op.rodzaj = a.rodzaj;
      }
      return op;
    },

    sprostowanie(r, p) {
      const zid = Number(r.zdarzenie_id);
      const cel = Number.isInteger(zid) ? k.zdarzenie(zid) : null;
      const tryb = wybor(r.tryb, ['zastap', 'wycofaj'], `${p}.tryb`, 'Wybierz: zastąpienie treści albo wycofanie wpisu.');
      if (!cel) {
        blad(`${p}.zdarzenie_id`, 'Wskaż wpis do sprostowania.');
        return { typ: 'sprostowanie', zdarzenie_id: zid, tryb };
      }
      if (cel.typ === 'sprostowanie') blad(`${p}.zdarzenie_id`, 'Sprostowania nie prostuje się — wskaż wpis, którego dotyczy.');
      if (cel.typ === 'otwarcie' && tryb === 'wycofaj') blad(`${p}.tryb`, 'Otwarcia rejestru nie wycofuje się — sprostuj jego treść.');
      const op = { typ: 'sprostowanie', zdarzenie_id: zid, tryb };
      if (tryb === 'zastap') {
        const zamiast = r.zamiast && typeof r.zamiast === 'object' ? r.zamiast : {};
        if (zamiast.typ !== cel.typ) blad(`${p}.zamiast`, 'Sprostowanie zastępuje treść wpisu tego samego rodzaju.');
        else op.zamiast = PRZYGOTUJ[cel.typ](zamiast, `${p}.zamiast`);
      }
      return op;
    },

    zamkniecie(r, p) {
      return {
        typ: 'zamkniecie',
        powod: wybor(r.powod, typy.POWODY_ZAMKNIECIA, `${p}.powod`, 'Wskaż powód zamknięcia rejestru.'),
      };
    },
  };

  return (r, pole) => {
    if (!r || !typy.istnieje(r.typ)) {
      blad(`${pole}.typ`, 'Nieznany rodzaj zmiany.');
      return null;
    }
    return PRZYGOTUJ[r.typ](r, pole);
  };
}

/** Robocze operacje sprawy → treść wpisów. Rzuca BladWalidacji z błędami przy polach. */
function przygotuj(robocze, k) {
  const bledy = [];
  const jedna = walidator(k, bledy);
  const operacje = (Array.isArray(robocze) ? robocze : []).map((r, i) => jedna(r, `operacje.${i}`));
  if (bledy.length > 0) throw new BladWalidacji(bledy);
  return operacje;
}

/**
 * Skład sprawy: co najmniej jedna zmiana; otwarcie, sprostowanie i zamknięcie osobno (z treści
 * roboczej); R3 i żądający „brak” — z treści po przygotowaniu (rodzaj wykreślanego obciążenia
 * wynika ze stanu). `operacje` = null, gdy przygotowanie się nie powiodło.
 */
function sprawdzSklad(robocze, operacje, zadajacy) {
  const bledy = [];
  const ops = Array.isArray(robocze) ? robocze : [];
  if (ops.length === 0) bledy.push({ pole: 'operacje', komunikat: 'Dodaj co najmniej jedną zmianę.' });
  if (ops.length > 1 && ops.some((o) => TYLKO_SAMODZIELNE.includes(o && o.typ))) {
    bledy.push({ pole: 'operacje', komunikat: 'Otwarcie, sprostowanie i zamknięcie rejestru to osobne sprawy.' });
  }
  if (!operacje || operacje.length === 0) return bledy;
  const zUrzedu = operacje.filter((o) => typy.zUrzedu(o));
  if (zUrzedu.length > 0 && zUrzedu.length !== operacje.length) {
    bledy.push({ pole: 'operacje', komunikat: 'Zajęcie wpisuje się z urzędu — w osobnej sprawie.' });
  }
  if (zUrzedu.length === operacje.length && zadajacy !== 'organ') {
    bledy.push({ pole: 'zadajacy', komunikat: 'Zajęcie wpisuje się na zawiadomienie organu — wskaż organ.' });
  }
  if (zadajacy === 'organ' && zUrzedu.length !== operacje.length) {
    bledy.push({ pole: 'zadajacy', komunikat: 'Organ jest żądającym tylko przy zajęciu.' });
  }
  if (zadajacy === 'brak' && operacje.some((o) => o.typ !== 'sprostowanie')) {
    bledy.push({ pole: 'zadajacy', komunikat: 'Wskaż żądającego — bez żądającego kancelaria dokonuje wyłącznie sprostowania.' });
  }
  return bledy;
}

/** Dane spółki w „Edytuj” (U-25) — błędy przy polach. */
function sprawdzSpolke(s) {
  const bledy = [];
  for (const pole of ['nazwa', 'siedziba', 'adres', 'sad_rejestrowy']) {
    if (s[pole] !== undefined && !tekst(s[pole])) bledy.push({ pole, komunikat: 'Pole nie może być puste.' });
  }
  if (s.data_rejestracji !== undefined && (!czas.poprawnaData(s.data_rejestracji) || s.data_rejestracji > czas.dzisIso())) {
    bledy.push({ pole: 'data_rejestracji', komunikat: 'Podaj prawidłową datę rejestracji spółki.' });
  }
  if (s.email && !osobyLogika.EMAIL.test(s.email)) bledy.push({ pole: 'email', komunikat: 'Nieprawidłowy adres e-mail.' });
  if (s.nip && !/^\d{10}$/.test(String(s.nip))) bledy.push({ pole: 'nip', komunikat: 'NIP to 10 cyfr.' });
  if (s.platnosc !== undefined && !['roczna', 'miesieczna'].includes(s.platnosc)) {
    bledy.push({ pole: 'platnosc', komunikat: 'Wybierz: raz w roku albo co miesiąc.' });
  }
  if (s.krs !== undefined && !/^\d{10}$/.test(String(s.krs))) bledy.push({ pole: 'krs', komunikat: 'Numer KRS to 10 cyfr.' });
  return bledy;
}

/**
 * Blokady R6 sprawdzalne bez odtwarzania: rejestr zamknięty albo nieotwarty, data wpisu emisji
 * do KRS (brak, z przyszłości, sprzeczna z datą rejestracji spółki — Z-012).
 */
function sprawdzBlokady(operacje, { stan, spolka, dzisiaj, zdarzenie }) {
  const bledy = [];
  const otwarcie = operacje.find((o) => o.typ === 'otwarcie');
  if (!stan.otwarty) {
    if (stan.data_zamkniecia) {
      const naZamkniecie = operacje.every(
        (o) => o.typ === 'sprostowanie' && (zdarzenie(o.zdarzenie_id) || {}).typ === 'zamkniecie'
      );
      if (!naZamkniecie) bledy.push('Rejestr spółki jest zamknięty — wpisy są niemożliwe.');
    } else if (!otwarcie) {
      bledy.push('Rejestr spółki nie został otwarty.');
    }
  } else if (otwarcie) {
    bledy.push('Rejestr tej spółki został już otwarty.');
  }

  const rejestracja = spolka.data_rejestracji;
  const daty = [];
  for (const o of operacje) {
    const op = o.typ === 'sprostowanie' ? o.zamiast : o;
    if (!op) continue;
    if (op.typ === 'emisja') {
      daty.push({ seria: op.seria, data: op.data_wpisu_krs });
      if (op.data_wpisu_krs <= rejestracja) {
        bledy.push(`Data wpisu emisji serii ${op.seria} do KRS (${op.data_wpisu_krs}) musi być późniejsza niż data rejestracji spółki (${rejestracja}).`);
      }
    }
    if (op.typ === 'otwarcie') {
      for (const s of op.serie) {
        daty.push({ seria: s.seria, data: s.data_wpisu_krs });
        if (s.data_wpisu_krs < rejestracja) {
          bledy.push(`Data wpisu serii ${s.seria} do KRS (${s.data_wpisu_krs}) nie może poprzedzać rejestracji spółki (${rejestracja}).`);
        }
      }
      if (op.serie.length > 0 && !op.serie.some((s) => s.data_wpisu_krs === rejestracja)) {
        bledy.push(`Emisja założycielska ma datę wpisu do KRS równą dacie rejestracji spółki (${rejestracja}).`);
      }
    }
  }
  for (const d of daty) {
    if (d.data > dzisiaj) bledy.push(`Data wpisu serii ${d.seria} do KRS (${d.data}) jest z przyszłości.`);
  }
  return bledy;
}

/** Treść wpisu → robocza (formularz „Sprostuj” wypełniony treścią wpisu). */
function naRobocza(wartosc) {
  if (Array.isArray(wartosc)) return wartosc.map(naRobocza);
  if (!wartosc || typeof wartosc !== 'object') return wartosc;
  const wynik = {};
  for (const [klucz, v] of Object.entries(wartosc)) {
    if (klucz === 'zakresy') wynik.numery = n.opisz(v);
    else if (klucz === 'czesc') wynik.ulamek = `${v.licznik}/${v.mianownik}`;
    else if (klucz === 'nr_od' && wartosc.nr_do != null) wynik.numery = n.opisz([{ nr_od: v, nr_do: wartosc.nr_do }]);
    else if (klucz !== 'nr_do') wynik[klucz] = naRobocza(v);
  }
  return wynik;
}

module.exports = { BladWalidacji, przygotuj, sprawdzSklad, sprawdzBlokady, sprawdzSpolke, naRobocza };
