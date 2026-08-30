'use strict';

/**
 * Deklinator polskich imion, nazwisk i nazw funkcji — sekcja 2.3 poprawek.
 *
 * Cel: użytkownik (docelowo klient) wpisuje dane w MIANOWNIKU („Jan Kowalski",
 * „Prezes Zarządu") — warstwa generowania szablonu sama wyprowadza biernik,
 * dopełniacz i narzędnik. To HEURYSTYKA oparta na najczęstszych wzorcach
 * polskiej odmiany, NIE pełny słownik fleksyjny — dla nazwisk nietypowych,
 * obcojęzycznych albo nieregularnych da błędny wynik. Dlatego wynik jest
 * zawsze tylko PROPOZYCJĄ: warstwa wywołująca (kreator, `kontekst-pisma.js`)
 * musi dać miejsce na ręczną korektę, nigdy nie traktować wyniku jako
 * pewnika (patrz `WYTYCZNE-MERYTORYCZNE-PSA.md` / prompt poprawek, sekcja 2.3).
 *
 * Bez płci NIE da się poprawnie odmienić biernika/celownika (różne końcówki
 * dla rodzaju męskiego i żeńskiego) — funkcje zwracają wtedy `null`.
 */

const PRZYPADKI = ['mianownik', 'dopelniacz', 'biernik', 'narzednik'];

const SPOLGLOSKI_MIEKKIE = new Set(['ć', 'dź', 'ń', 'l', 'j', 'rz', 'sz', 'cz', 'ż', 'ś', 'ź', 'c', 'dz', 'k', 'g']);

function ostatniaSpolgloskaPrzedA(rdzen) {
  // Dwuznaki maja pierwszenstwo (np. "rz", "sz", "cz", "dz").
  const dwuznak = rdzen.slice(-2).toLowerCase();
  if (SPOLGLOSKI_MIEKKIE.has(dwuznak)) return dwuznak;
  return rdzen.slice(-1).toLowerCase();
}

/**
 * Odmiana pojedynczego IMIENIA (albo pierwszego czlonu nazwiska nie
 * bedacego przymiotnikowym) - dopelniacz i biernik dla imion meskich sa
 * TAKIE SAME (rzeczownik meskoosobowy), dla zenskich - rozne.
 */
function odmienSlowo(slowo, przypadek, plec) {
  if (!slowo) return slowo;
  if (przypadek === 'mianownik') return slowo;
  if (!plec) return null;

  // Koncowka "-eł" (np. Paweł, Anioł) traci "e" w odmianie: Paweł -> Pawła.
  if (/eł$/i.test(slowo) && plec === 'mezczyzna') {
    const rdzen = slowo.slice(0, -2) + 'ł';
    if (przypadek === 'narzednik') return `${rdzen}em`;
    return `${rdzen}a`; // dopelniacz = biernik
  }

  // Nazwiska/przymiotnikowe koncowki -ski/-cki/-dzki (i zenskie -ska/-cka/-dzka).
  if (/ski$/i.test(slowo) && plec === 'mezczyzna') {
    const rdzen = slowo.slice(0, -1); // bez koncowego "i"
    if (przypadek === 'narzednik') return `${rdzen}im`;
    return `${rdzen}iego`; // dopelniacz = biernik
  }
  if (/ska$/i.test(slowo) && plec === 'kobieta') {
    const rdzen = slowo.slice(0, -1); // bez koncowego "a"
    if (przypadek === 'dopelniacz') return `${rdzen}iej`;
    return `${rdzen}ą`; // biernik = narzednik dla tej koncowki
  }

  if (plec === 'mezczyzna') {
    // Wiekszosc imion/nazwisk meskich konczy sie spolgloska - dopelniacz =
    // biernik = rdzen + "a"; narzednik = rdzen + "em" (po k/g: "-iem").
    if (/[bcćdfghjklłmnńprsśtwzźż]$/i.test(slowo)) {
      if (przypadek === 'narzednik') {
        return /[kg]$/i.test(slowo) ? `${slowo}iem` : `${slowo}em`;
      }
      return `${slowo}a`;
    }
    // Koncowka na samogloske (rzadkie, np. obce nazwiska) - nie zgadujemy.
    return null;
  }

  if (plec === 'kobieta') {
    if (/a$/i.test(slowo)) {
      const rdzen = slowo.slice(0, -1);
      if (przypadek === 'dopelniacz') {
        // Koncowka "-ia" (Maria, Zofia, Julia...) - rdzen juz konczy sie na
        // "i" (samogloska), dopelniacz to rdzen + "i" (Maria -> Marii), nie
        // ogolna regula dla spolgloski przed "a".
        if (/i$/i.test(rdzen)) return `${rdzen}i`;
        const spolgloska = ostatniaSpolgloskaPrzedA(rdzen);
        return SPOLGLOSKI_MIEKKIE.has(spolgloska) ? `${rdzen}i` : `${rdzen}y`;
      }
      if (przypadek === 'narzednik') return `${rdzen}ą`;
      return `${rdzen}ę`; // biernik
    }
    // Imiona/nazwiska zenskie zakonczone spolgloska sa w polskim NIEODMIENNE.
    return slowo;
  }

  return null;
}

function odmienSlowoPelne(slowo, przypadek, plec) {
  return odmienSlowo(slowo, przypadek, plec);
}

/**
 * Odmienia pelne imie i nazwisko w mianowniku (np. "Jan Kowalski",
 * "Łukasz Adrian Szymborski") - ostatni wyraz traktowany jako nazwisko,
 * pozostale jako imiona. Zwraca null, jesli ktoregokolwiek slowa nie da
 * sie bezpiecznie odmienic (zamiast zgadywac czesciowo).
 */
function odmienImieNazwisko(pelneMianownik, przypadek, plec) {
  const slowa = String(pelneMianownik || '').trim().split(/\s+/).filter(Boolean);
  if (slowa.length === 0) return null;
  if (przypadek === 'mianownik') return slowa.join(' ');
  if (!plec) return null;

  const odmienione = slowa.map((s) => odmienSlowoPelne(s, przypadek, plec));
  if (odmienione.some((s) => s == null)) return null;
  return odmienione.join(' ');
}

/** Dopełniacz pojedynczego imienia (do „syna/córki Piotra i Anny"). */
function odmienImieDopelniacz(imie, plec) {
  return odmienSlowoPelne(imie, 'dopelniacz', plec);
}

/**
 * „Rodzice w dopełniaczu" z mianownikowego zapisu typu „Piotr i Anna" albo
 * „Piotr Kowalski i Anna Kowalska". Rozdziela po " i ", odmienia obie strony
 * OSOBNO (bo mogą mieć różną płeć) - domyślnie ojciec/mężczyzna, matka/kobieta,
 * zgodnie z konwencją zapisu „ojciec i matka". Zwraca null, jeśli nie da się
 * bezpiecznie rozdzielić albo odmienić którejkolwiek strony.
 */
function odmienRodzicow(tekst) {
  const czesci = String(tekst || '').split(/\s+i\s+/i).map((c) => c.trim()).filter(Boolean);
  if (czesci.length !== 2) return null;
  const [ojciec, matka] = czesci;
  const ojciecOdm = odmienImieNazwisko(ojciec, 'dopelniacz', 'mezczyzna');
  const matkaOdm = odmienImieNazwisko(matka, 'dopelniacz', 'kobieta');
  if (!ojciecOdm || !matkaOdm) return null;
  return `${ojciecOdm} i ${matkaOdm}`;
}

/**
 * Słownik najczęstszych funkcji w organach P.S.A. (biernik) - bezpieczniejszy
 * niż odmiana słowo-po-słowie, bo drugi człon („Zarządu", „Dyrektorów") jest
 * już w dopełniaczu w mianowniku i nie wolno go odmieniać dalej.
 */
const FUNKCJE_BIERNIK = {
  'prezes zarządu': 'Prezesa Zarządu',
  'wiceprezes zarządu': 'Wiceprezesa Zarządu',
  'członek zarządu': 'Członka Zarządu',
  'przewodniczący rady dyrektorów': 'Przewodniczącego Rady Dyrektorów',
  'wiceprzewodniczący rady dyrektorów': 'Wiceprzewodniczącego Rady Dyrektorów',
  'dyrektor': 'Dyrektora',
  'dyrektor wykonawczy': 'Dyrektora Wykonawczego',
  'dyrektor niewykonawczy': 'Dyrektora Niewykonawczego',
  'prokurent': 'Prokurenta',
  'wspólnik': 'Wspólnika',
  'wspólniczka': 'Wspólniczkę',
};

/** Biernik nazwy funkcji - słownik dla znanych tytułów, inaczej null (ręczna korekta). */
function odmienFunkcjeBiernik(funkcjaMianownik) {
  const klucz = String(funkcjaMianownik || '').trim().toLowerCase();
  return FUNKCJE_BIERNIK[klucz] || null;
}

module.exports = {
  PRZYPADKI,
  odmienSlowo: odmienSlowoPelne,
  odmienImieNazwisko,
  odmienImieDopelniacz,
  odmienRodzicow,
  odmienFunkcjeBiernik,
};
