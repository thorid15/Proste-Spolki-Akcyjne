'use strict';

/**
 * Trasy `/api/psa/szablony/...` — wzory pism z dysku (blok A1 sesji 8).
 *
 * Zastępuje redakcję szablonów HTML z sesji 6 (faza 4). Treść pisma NIE żyje
 * w bazie i nie edytuje się jej tu — źródłem jest plik `.docx` w `wzory/`,
 * a notariusz redaguje go w Wordzie i podmienia (`wzory/README.md`). Te trasy
 * wyłącznie CZYTAJĄ katalog i pokazują podgląd — stąd brak PUT/POST-a
 * zmieniającego treść, DELETE-a i historii wersji: nie ma tu niczego do
 * zmiany przez API, wersjonowanie idzie przez git i przez skrót pliku
 * zapisywany przy każdym wydaniu (`psa_wydane_dokumenty.szablon_hash`).
 *
 * Zastrzeżone dla administratora z tego samego powodu, co poprzednio: to
 * ekran kontrolny nad pismami o skutkach prawnych, nie miejsce do przypadkowego
 * zajrzenia.
 */

const express = require('express');

const wzoryDysk = require('../logika/wzory-dysk');
const docx = require('../logika/docx');
const { DANE_PROBNE } = require('../logika/dane-probne');
const { asy, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { wymagajAdmina } = require('../pomocnicze/autoryzacja');

const router = express.Router();

const TYP_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function analizujAlbo404(kod) {
  try {
    return wzoryDysk.analizuj(kod);
  } catch {
    throw nieZnaleziono(`Nie ma wzoru o kodzie „${kod}" w katalogu wzory/.`);
  }
}

/** Lista wzorów z katalogu — jeden wiersz na plik, z wynikiem walidacji. */
router.get(
  '/',
  wymagajAdmina,
  asy((zad, odp) => {
    const szablony = wzoryDysk.listaWzorow().map((w) => wzoryDysk.analizuj(w.kod));
    odp.json({ szablony });
  })
);

/**
 * Katalog WSZYSTKICH kluczy, jakie aplikacja umie podstawić — nie tylko
 * użytych w konkretnym wzorze. Wzór redaguje się w Wordzie, poza aplikacją
 * (blok A1), więc to jest jedyne miejsce, gdzie notariusz sprawdzi, czego
 * może użyć, PISZĄC nowy fragment pisma.
 *
 * Źródłem jest `DANE_PROBNE` — ten sam komplet, na którym renderuje się
 * podgląd, więc lista nigdy nie rozjedzie się z tym, co faktycznie działa.
 */
router.get(
  '/dostepne-klucze',
  wymagajAdmina,
  asy((zad, odp) => {
    const proste = [];
    const sekcje = [];
    for (const [klucz, wartosc] of Object.entries(DANE_PROBNE)) {
      (Array.isArray(wartosc) ? sekcje : proste).push(klucz);
    }
    proste.sort();
    sekcje.sort();
    odp.json({ proste, sekcje });
  })
);

/** Szczegóły jednego wzoru — te same dane, co w liście, dla podglądu w panelu bocznym. */
router.get(
  '/:kod',
  wymagajAdmina,
  asy((zad, odp) => {
    odp.json({ szablon: analizujAlbo404(zad.params.kod) });
  })
);

/**
 * Podgląd na danych próbnych — jako zwykły tekst (bez formatowania), bo
 * renderowanie `.docx` do HTML wymagałoby biblioteki, a master jej zabrania
 * (sekcja 4). Do zobaczenia GOTOWEGO pisma z formatowaniem służy
 * `/podglad.docx` niżej — ten sam plik, który dostałby klient.
 */
router.post(
  '/:kod/podglad',
  wymagajAdmina,
  asy((zad, odp) => {
    analizujAlbo404(zad.params.kod);
    const wynik = wzoryDysk.wypelnij(zad.params.kod, DANE_PROBNE);
    odp.json({
      tekst: docx.tekst(wynik.plik),
      brakujace: wynik.brakujace,
      bledy: wynik.bledy,
      ostrzezenia: wynik.ostrzezenia,
      hashKrotki: wynik.hash.slice(0, 12),
      na_danych_probnych: true,
    });
  })
);

/** To samo, ale jako prawdziwy plik `.docx` do otwarcia w Wordzie. */
router.get(
  '/:kod/podglad.docx',
  wymagajAdmina,
  asy((zad, odp) => {
    const { plik } = analizujAlbo404(zad.params.kod);
    const wynik = wzoryDysk.wypelnij(zad.params.kod, DANE_PROBNE);
    odp.setHeader('Content-Type', TYP_DOCX);
    odp.setHeader('Content-Disposition', `attachment; filename="probny-${plik}"`);
    odp.send(wynik.plik);
  })
);

module.exports = router;
