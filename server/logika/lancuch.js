'use strict';

/**
 * Lancuch skrotow nad `psa_zdarzenia` (sekcja 5 i 11 specyfikacji).
 *
 * Lancuch jest GLOBALNY (nie per spolka) - dzieki temu wykrywa takze usuniecie
 * calego rekordu, nie tylko jego podmiane. Implementacja na `node:crypto`,
 * zero zaleznosci zewnetrznych.
 *
 * Serializacja: pola laczymy separatorem U+001F (UNIT SEPARATOR). Znak ten nie
 * moze wystapic doslownie w wyniku `JSON.stringify` (znaki sterujace sa tam
 * escape'owane), a z `autor` usuwamy znaki sterujace przy zapisie. Granice pol
 * sa wiec jednoznaczne - samo sklejenie wartosci pozwalaloby przesunac
 * zawartosc miedzy sasiednimi polami bez zmiany skrotu.
 *
 * Swiadomie NIE robimy (sekcja 11): kwalifikowanych znacznikow czasu, drzew
 * Merkle'a, publikacji skrotow, XAdES/PAdES.
 */

const crypto = require('node:crypto');

const SEP = '\u001F';

/** Skrot rekordu poprzedzajacego pierwszy wpis w lancuchu. */
const HASH_POCZATKOWY = '0'.repeat(64);

/**
 * Kanoniczny JSON: klucze obiektow posortowane, brak zbednych spacji.
 * Ta sama tresc daje zawsze ten sam ciag - warunek powtarzalnosci skrotu.
 * Zapisujemy do bazy DOKLADNIE ten ciag, ktory hashujemy.
 */
function kanonicznyJson(wartosc) {
  return JSON.stringify(uporzadkuj(wartosc));
}

function uporzadkuj(wartosc) {
  if (Array.isArray(wartosc)) return wartosc.map(uporzadkuj);
  if (wartosc && typeof wartosc === 'object') {
    const wynik = {};
    for (const klucz of Object.keys(wartosc).sort()) {
      if (wartosc[klucz] === undefined) continue;
      wynik[klucz] = uporzadkuj(wartosc[klucz]);
    }
    return wynik;
  }
  return wartosc;
}

/** Usuwa znaki sterujace - chroni jednoznacznosc granic pol w skrocie. */
function oczysc(tekst) {
  // eslint-disable-next-line no-control-regex
  return String(tekst == null ? '' : tekst).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
}

/**
 * Skrot pojedynczego zdarzenia.
 * hash = sha256(id | spolka_id | typ | data_zdarzenia | data_wpisu | autor | dane_json | hash_poprzedni)
 */
function skrot(zdarzenie) {
  const pola = [
    String(zdarzenie.id),
    String(zdarzenie.spolka_id),
    String(zdarzenie.typ),
    String(zdarzenie.data_zdarzenia),
    String(zdarzenie.data_wpisu),
    oczysc(zdarzenie.autor),
    String(zdarzenie.dane_json),
    String(zdarzenie.hash_poprzedni),
  ];
  return crypto.createHash('sha256').update(pola.join(SEP), 'utf8').digest('hex');
}

/**
 * Weryfikuje ciaglosc lancucha. Zdarzenia musza byc podane rosnaco po `id`.
 * Zwraca { ok, sprawdzono, blad } - `blad` opisuje PIERWSZY zerwany rekord.
 */
function zweryfikuj(zdarzenia) {
  let poprzedni = HASH_POCZATKOWY;
  let sprawdzono = 0;

  for (const z of zdarzenia) {
    if (z.hash_poprzedni !== poprzedni) {
      return {
        ok: false,
        sprawdzono,
        blad: {
          id: z.id,
          rodzaj: 'zerwane_ogniwo',
          opis:
            `Zdarzenie #${z.id} wskazuje na skrót poprzednika, który nie zgadza się z rzeczywistym ` +
            `skrótem zdarzenia poprzedzającego. Rekord z łańcucha mógł zostać usunięty lub przestawiony.`,
          oczekiwano: poprzedni,
          zapisano: z.hash_poprzedni,
        },
      };
    }
    const wyliczony = skrot(z);
    if (wyliczony !== z.hash) {
      return {
        ok: false,
        sprawdzono,
        blad: {
          id: z.id,
          rodzaj: 'zmieniona_tresc',
          opis:
            `Treść zdarzenia #${z.id} nie odpowiada zapisanemu skrótowi. ` +
            `Rekord został zmieniony poza aplikacją.`,
          oczekiwano: z.hash,
          zapisano: wyliczony,
        },
      };
    }
    poprzedni = z.hash;
    sprawdzono += 1;
  }

  return { ok: true, sprawdzono, blad: null };
}

module.exports = { HASH_POCZATKOWY, kanonicznyJson, oczysc, skrot, zweryfikuj, SEP };
