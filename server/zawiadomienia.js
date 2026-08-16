'use strict';

/**
 * Generowanie i wysylka dokumentow wychodzacych ze sprawy (sekcja 10
 * specyfikacji): zawiadomienie o wpisie, zawiadomienie o odmowie, wezwanie
 * do uzupelnienia, powiadomienie z art. 300(34) § 3 KSH.
 *
 * Od bloku A4 sesji 8 kazde z tych czterech pism to wypelniony wzor .docx
 * z `wzory/` (`logika/wzory-dysk.js` + `logika/kontekst-pisma.js`), nie HTML
 * skladany w locie. Klient dostaje gotowy plik do podpisu jako zalacznik
 * maila; tresc maila to krotkie wprowadzenie plus podglad tekstowy pisma -
 * zeby dalo sie zorientowac w tresci bez otwierania zalacznika.
 *
 * Kazda proba wysylki - udana czy nie - zostawia slad w
 * `psa_wydane_dokumenty` (kolumna `wyslano` jest NULL, dopoki wysylka
 * faktycznie sie nie powiedzie). To osobna warstwa od `rejestr.js`: dotyka
 * sieci (SMTP) i dysku, wiec NIGDY nie jest wywolywana wewnatrz transakcji
 * SQLite.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const wzoryDysk = require('./logika/wzory-dysk');
const docx = require('./logika/docx');
const { esc } = require('./logika/szablony');
const kontekstPisma = require('./logika/kontekst-pisma');
const przepisy = require('./logika/przepisy');
const widoki = require('./widoki');
const dokTresc = require('./logika/dokumenty-tresc');
const terminy = require('./logika/terminy');
const poczta = require('./poczta');
const czas = require('./pomocnicze/czas');
const konfiguracja = require('./konfiguracja');

/** Wzór z `wzory/` odpowiadający każdemu z czterech pism automatu. */
const WZOR_KOD = {
  zawiadomienie_wpis: '07',
  zawiadomienie_odmowa: '09',
  wezwanie: '06',
  powiadomienie: '05',
};

function zapiszWydanyDokument(db, { sprawaId, spolkaId, typ, odbiorcaOsobaId, kanal, trescHtml, sciezkaPlik, szablonKod, szablonHash, wyslano, autor }) {
  const wynik = db
    .prepare(
      `INSERT INTO psa_wydane_dokumenty
         (sprawa_id, spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html,
          sciezka_plik, szablon_kod, szablon_hash, wyslano, autor, utworzono)
       VALUES
         (@sprawaId, @spolkaId, @typ, @odbiorcaOsobaId, @kanal, @trescHtml,
          @sciezkaPlik, @szablonKod, @szablonHash, @wyslano, @autor, @utworzono)`
    )
    .run({
      sprawaId,
      spolkaId,
      typ,
      odbiorcaOsobaId: odbiorcaOsobaId ?? null,
      kanal,
      trescHtml,
      sciezkaPlik: sciezkaPlik ?? null,
      szablonKod: szablonKod ?? null,
      szablonHash: szablonHash ?? null,
      wyslano: wyslano ?? null,
      autor,
      utworzono: czas.terazIso(),
    });
  return Number(wynik.lastInsertRowid);
}

/** Zapisuje wypełniony plik obok załączników do sprawy (`server/trasy/sprawy.js:katalogSprawy`). */
function zapiszPlikNaDysku({ spolkaId, sprawaId, wzorPlik, bufor }) {
  const katalog = path.join(konfiguracja.KATALOG_DOKUMENTOW, `spolka_${spolkaId}`, `sprawa_${sprawaId}`, 'wydane');
  fs.mkdirSync(katalog, { recursive: true });
  const nazwa = `${crypto.randomUUID()}-${wzorPlik}`;
  fs.writeFileSync(path.join(katalog, nazwa), bufor);
  return path.relative(konfiguracja.KATALOG_DOKUMENTOW, path.join(katalog, nazwa));
}

/**
 * Wypełnia wzór, zapisuje plik na dysku, wysyła mailem z załącznikiem
 * i zostawia ślad w `psa_wydane_dokumenty`. Brakujące klucze NIE blokują
 * wysyłki (pismo idzie z widocznym „—" zamiast zgadniętej treści), ale
 * wracają w wyniku — wywołujący pokazuje je jako ostrzeżenie do sprawdzenia.
 */
async function wydajIWyslij(db, { wzorTyp, dane, sprawaId, spolkaId, odbiorcaOsobaId, odbiorcaEmail, temat, autor }) {
  const kod = WZOR_KOD[wzorTyp];
  const wynik = wzoryDysk.wypelnij(kod, dane);
  const tekst = docx.tekst(wynik.plik);
  const nazwaPliku = `${wynik.nazwa.replace(/\s+/g, '-')}.docx`;
  const sciezkaPlik = zapiszPlikNaDysku({ spolkaId, sprawaId, wzorPlik: nazwaPliku, bufor: wynik.plik });

  const html = `
    <p>W załączeniu przesyłamy pismo. Treść (bez formatowania, do szybkiego wglądu):</p>
    <pre style="white-space: pre-wrap; font-family: Georgia, 'Times New Roman', serif; font-size: 13px;">${esc(tekst)}</pre>
  `;

  const proba = await poczta.wyslij({
    do: odbiorcaEmail,
    temat,
    html,
    zalaczniki: [{ filename: nazwaPliku, content: wynik.plik }],
  });

  const id = zapiszWydanyDokument(db, {
    sprawaId,
    spolkaId,
    typ: wzorTyp,
    odbiorcaOsobaId,
    kanal: 'email',
    trescHtml: tekst,
    sciezkaPlik,
    szablonKod: kod,
    szablonHash: wynik.hash,
    wyslano: proba.wyslano ? czas.terazIso() : null,
    autor,
  });

  return { id, ...proba, brakujace: wynik.brakujace, bledy: wynik.bledy };
}

/** art. 300(34) § 7 KSH — niezwłoczne powiadomienie żądającego i spółki o wpisie. */
async function poWpisie(db, { sprawa, zdarzenie, spolka, osoby, podsumowanie, autor }) {
  const stanNaDzien = widoki.widokStanu(db, spolka.id, zdarzenie.data_zdarzenia, {
    rola: przepisy.ROLE_ODBIORCY.KANCELARIA,
  });
  const akcjonariusze = stanNaDzien ? stanNaDzien.akcjonariusze : [];
  const dzis = czas.dzisIso();
  const zadajacy = sprawa.zadajacy_osoba_id ? osoby.get(sprawa.zadajacy_osoba_id) : null;

  const wyniki = [];

  if (sprawa.zadajacy_osoba_id) {
    const dane = kontekstPisma.zawiadomienieWpisu({
      spolka, sprawa, zdarzenie, wpisOpis: podsumowanie, zadajacy, akcjonariusze, wariant: 'zadajacy', dzis,
    });
    wyniki.push({
      odbiorca: 'żądający',
      ...(await wydajIWyslij(db, {
        wzorTyp: 'zawiadomienie_wpis',
        dane,
        sprawaId: sprawa.id,
        spolkaId: spolka.id,
        odbiorcaOsobaId: sprawa.zadajacy_osoba_id,
        odbiorcaEmail: zadajacy ? zadajacy.email : null,
        temat: `Zawiadomienie o wpisie do rejestru — ${spolka.nazwa}`,
        autor,
      })),
    });
  }

  const daneSpolka = kontekstPisma.zawiadomienieWpisu({
    spolka, sprawa, zdarzenie, wpisOpis: podsumowanie, zadajacy, akcjonariusze, wariant: 'spolka', dzis,
  });
  wyniki.push({
    odbiorca: 'spółka',
    ...(await wydajIWyslij(db, {
      wzorTyp: 'zawiadomienie_wpis',
      dane: daneSpolka,
      sprawaId: sprawa.id,
      spolkaId: spolka.id,
      odbiorcaOsobaId: null,
      odbiorcaEmail: spolka.email,
      temat: `Zawiadomienie o wpisie do rejestru — ${spolka.nazwa}`,
      autor,
    })),
  });

  // art. 300(34) § 8 KSH — po zawiadomieniu o wpisie zarzad niezwlocznie
  // sklada do sadu rejestrowego nowa liste akcjonariuszy. Przygotowujemy ja
  // razem z zawiadomieniem, do podpisu wszystkich czlonkow zarzadu
  // (CLAUDE-PSA.md sekcja 10) - nie skladamy jej sami do sadu, to obowiazek
  // zarzadu. Zostaje na starym mechanizmie HTML - przelaczenie na wzor 08
  // to blok A5 (dotyczy dokumentow wystawianych, nie automatu z tej sesji).
  if (stanNaDzien) {
    const wykazHtml = dokTresc.wykazAkcjonariuszy({
      kancelaria: konfiguracja.KANCELARIA,
      spolka: stanNaDzien.spolka,
      data: zdarzenie.data_zdarzenia,
      stan: stanNaDzien,
      powod: przepisy.PODSTAWY.LISTA_AKCJONARIUSZY_KRS,
    });
    const proba = await poczta.wyslij({
      do: spolka.email,
      temat: `Lista akcjonariuszy do zgłoszenia w KRS — ${spolka.nazwa}`,
      html: wykazHtml,
    });
    const id = zapiszWydanyDokument(db, {
      sprawaId: sprawa.id,
      spolkaId: spolka.id,
      typ: 'wykaz_akcjonariuszy',
      odbiorcaOsobaId: null,
      kanal: 'email',
      trescHtml: wykazHtml,
      wyslano: proba.wyslano ? czas.terazIso() : null,
      autor,
    });
    wyniki.push({ odbiorca: 'spółka (lista akcjonariuszy do KRS)', id, ...proba });
  }

  return wyniki;
}

/** art. 300(34) § 7 zd. 2 KSH — odmowa, z podaniem przyczyn, do żądającego. */
async function poOdmowie(db, { sprawa, spolka, osoby, autor }) {
  const zadajacy = sprawa.zadajacy_osoba_id ? osoby.get(sprawa.zadajacy_osoba_id) : null;
  const dane = kontekstPisma.zawiadomienieNiedokonania({ spolka, sprawa, zadajacy, osoby, dzis: czas.dzisIso() });

  return wydajIWyslij(db, {
    wzorTyp: 'zawiadomienie_odmowa',
    dane,
    sprawaId: sprawa.id,
    spolkaId: spolka.id,
    odbiorcaOsobaId: sprawa.zadajacy_osoba_id,
    odbiorcaEmail: zadajacy ? zadajacy.email : null,
    temat: `Zawiadomienie o odmowie wpisu — ${spolka.nazwa}`,
    autor,
  });
}

/** Wezwanie do uzupełnienia, wysyłane przy przejściu sprawy w stan „wstrzymana”. */
async function wezwanie(db, { sprawa, spolka, osoby, powodWstrzymania, autor }) {
  const zadajacy = sprawa.zadajacy_osoba_id ? osoby.get(sprawa.zadajacy_osoba_id) : null;
  const dane = kontekstPisma.wezwanieDoUzupelnienia({
    spolka, sprawa, zadajacy, osoby, powodWstrzymania, dzis: czas.dzisIso(),
  });

  return wydajIWyslij(db, {
    wzorTyp: 'wezwanie',
    dane,
    sprawaId: sprawa.id,
    spolkaId: spolka.id,
    odbiorcaOsobaId: sprawa.zadajacy_osoba_id,
    odbiorcaEmail: zadajacy ? zadajacy.email : null,
    temat: `Wezwanie do uzupełnienia — ${spolka.nazwa}`,
    autor,
  });
}

/**
 * art. 300(34) § 3 KSH — uprzednie powiadomienie osoby, ktorej uprawnienia
 * maja byc wykreslone, zmienione lub obciazone, o tresci zamierzonego wpisu.
 * Wysylane NA ZADANIE pracownika (endpoint `/sprawy/:id/powiadomienie`),
 * przed dokonaniem wpisu - alternatywa dla zgody odnotowanej wprost.
 */
async function powiadomienieUprzednie(db, { sprawa, spolka, osoby, odbiorca, autor }) {
  const zadajacy = sprawa.zadajacy_osoba_id ? osoby.get(sprawa.zadajacy_osoba_id) : null;
  const dzis = czas.dzisIso();
  // Wpis jeszcze nie zaszedl - pokazujemy stan rejestru NA DZIS, nie "po wpisie".
  const stanDzis = widoki.widokStanu(db, spolka.id, dzis, { rola: przepisy.ROLE_ODBIORCY.KANCELARIA });
  // Bez podstawy ustawowej co do liczby dni (art. 300(34) § 3 KSH mowi tylko
  // "w terminie umozliwiajacym rozpatrzenie przed wpisem") - liczymy jako
  // wewnetrzny cel 3-dniowy, patrz komentarz w logika/kontekst-pisma.js.
  const terminStanowiska = terminy.dodajDni(dzis, przepisy.CEL_WEWNETRZNY.WPIS_DNI);
  const dane = kontekstPisma.powiadomienieUprzednie({
    spolka, sprawa, zadajacy, odbiorca, osoby, terminStanowiska,
    akcjonariusze: stanDzis ? stanDzis.akcjonariusze : [], dzis,
  });

  return wydajIWyslij(db, {
    wzorTyp: 'powiadomienie',
    dane,
    sprawaId: sprawa.id,
    spolkaId: spolka.id,
    odbiorcaOsobaId: odbiorca.id,
    odbiorcaEmail: odbiorca.email,
    temat: `Powiadomienie o treści zamierzonego wpisu — ${spolka.nazwa}`,
    autor,
  });
}

module.exports = { poWpisie, poOdmowie, wezwanie, powiadomienieUprzednie, zapiszWydanyDokument };
