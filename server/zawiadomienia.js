'use strict';

/**
 * Generowanie i wysylka dokumentow wychodzacych ze sprawy (sekcja 10
 * specyfikacji): zawiadomienie o wpisie, zawiadomienie o odmowie, wezwanie
 * do uzupelnienia, powiadomienie z art. 300(34) § 3 KSH.
 *
 * Kazda proba wysylki - udana czy nie - zostawia slad w
 * `psa_wydane_dokumenty` (kolumna `wyslano` jest NULL, dopoki wysylka
 * faktycznie sie nie powiedzie). To osobna warstwa od `rejestr.js`: dotyka
 * sieci (SMTP), wiec NIGDY nie jest wywolywana wewnatrz transakcji SQLite.
 */

const dokTresc = require('./logika/dokumenty-tresc');
const typyZdarzen = require('./logika/typy-zdarzen');
const przepisy = require('./logika/przepisy');
const widoki = require('./widoki');
const poczta = require('./poczta');
const czas = require('./pomocnicze/czas');
const konfiguracja = require('./konfiguracja');

function zapiszWydanyDokument(db, { sprawaId, spolkaId, typ, odbiorcaOsobaId, kanal, trescHtml, wyslano, autor }) {
  const wynik = db
    .prepare(
      `INSERT INTO psa_wydane_dokumenty
         (sprawa_id, spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html, wyslano, autor, utworzono)
       VALUES
         (@sprawaId, @spolkaId, @typ, @odbiorcaOsobaId, @kanal, @trescHtml, @wyslano, @autor, @utworzono)`
    )
    .run({
      sprawaId,
      spolkaId,
      typ,
      odbiorcaOsobaId: odbiorcaOsobaId ?? null,
      kanal,
      trescHtml,
      wyslano: wyslano ?? null,
      autor,
      utworzono: czas.terazIso(),
    });
  return Number(wynik.lastInsertRowid);
}

async function wyslijIZapisz(db, { sprawaId, spolkaId, typ, odbiorcaOsobaId, odbiorcaEmail, temat, html, autor }) {
  const proba = await poczta.wyslij({ do: odbiorcaEmail, temat, html });
  const id = zapiszWydanyDokument(db, {
    sprawaId,
    spolkaId,
    typ,
    odbiorcaOsobaId,
    kanal: 'email',
    trescHtml: html,
    wyslano: proba.wyslano ? czas.terazIso() : null,
    autor,
  });
  return { id, ...proba };
}

/** art. 300(34) § 7 KSH — niezwłoczne powiadomienie żądającego i spółki o wpisie. */
async function poWpisie(db, { sprawa, zdarzenie, spolka, osoby, podsumowanie, autor }) {
  const typZdarzenie = typyZdarzen.typ(zdarzenie.typ);
  const html = dokTresc.zawiadomienieWpis({
    kancelaria: konfiguracja.KANCELARIA,
    spolka,
    zdarzenie,
    typZdarzenie,
    podsumowanie,
  });

  const wyniki = [];

  if (sprawa.zadajacy_osoba_id) {
    const zadajacy = osoby.get(sprawa.zadajacy_osoba_id) || null;
    wyniki.push({
      odbiorca: 'żądający',
      ...(await wyslijIZapisz(db, {
        sprawaId: sprawa.id,
        spolkaId: spolka.id,
        typ: 'zawiadomienie_wpis',
        odbiorcaOsobaId: sprawa.zadajacy_osoba_id,
        odbiorcaEmail: zadajacy ? zadajacy.email : null,
        temat: `Zawiadomienie o wpisie do rejestru — ${spolka.nazwa}`,
        html,
        autor,
      })),
    });
  }

  wyniki.push({
    odbiorca: 'spółka',
    ...(await wyslijIZapisz(db, {
      sprawaId: sprawa.id,
      spolkaId: spolka.id,
      typ: 'zawiadomienie_wpis',
      odbiorcaOsobaId: null,
      odbiorcaEmail: spolka.email,
      temat: `Zawiadomienie o wpisie do rejestru — ${spolka.nazwa}`,
      html,
      autor,
    })),
  });

  // art. 300(34) § 8 KSH — po zawiadomieniu o wpisie zarzad niezwlocznie
  // sklada do sadu rejestrowego nowa liste akcjonariuszy. Przygotowujemy ja
  // razem z zawiadomieniem, do podpisu wszystkich czlonkow zarzadu (CLAUDE-PSA.md
  // sekcja 10) - nie skladamy jej sami do sadu, to obowiazek zarzadu.
  const stanNaDzien = widoki.widokStanu(db, spolka.id, zdarzenie.data_zdarzenia, {
    rola: przepisy.ROLE_ODBIORCY.SPOLKA,
  });
  if (stanNaDzien) {
    const wykazHtml = dokTresc.wykazAkcjonariuszy({
      kancelaria: konfiguracja.KANCELARIA,
      spolka: stanNaDzien.spolka,
      data: zdarzenie.data_zdarzenia,
      stan: stanNaDzien,
      powod: przepisy.PODSTAWY.LISTA_AKCJONARIUSZY_KRS,
    });
    wyniki.push({
      odbiorca: 'spółka (lista akcjonariuszy do KRS)',
      ...(await wyslijIZapisz(db, {
        sprawaId: sprawa.id,
        spolkaId: spolka.id,
        typ: 'wykaz_akcjonariuszy',
        odbiorcaOsobaId: null,
        odbiorcaEmail: spolka.email,
        temat: `Lista akcjonariuszy do zgłoszenia w KRS — ${spolka.nazwa}`,
        html: wykazHtml,
        autor,
      })),
    });
  }

  return wyniki;
}

/** art. 300(34) § 7 zd. 2 KSH — odmowa, z podaniem przyczyn, do żądającego. */
async function poOdmowie(db, { sprawa, spolka, osoby, powodOdmowy, autor }) {
  const typZdarzenie = typyZdarzen.typ(sprawa.typ_zdarzenia);
  const html = dokTresc.zawiadomienieOdmowa({
    kancelaria: konfiguracja.KANCELARIA,
    spolka,
    typZdarzenie,
    powodOdmowy,
    odbiorcaNazwa: null,
  });
  const zadajacy = sprawa.zadajacy_osoba_id ? osoby.get(sprawa.zadajacy_osoba_id) : null;

  return wyslijIZapisz(db, {
    sprawaId: sprawa.id,
    spolkaId: spolka.id,
    typ: 'zawiadomienie_odmowa',
    odbiorcaOsobaId: sprawa.zadajacy_osoba_id,
    odbiorcaEmail: zadajacy ? zadajacy.email : null,
    temat: `Zawiadomienie o odmowie wpisu — ${spolka.nazwa}`,
    html,
    autor,
  });
}

/** Wezwanie do uzupełnienia, wysyłane przy przejściu sprawy w stan „wstrzymana”. */
async function wezwanie(db, { sprawa, spolka, osoby, powodWstrzymania, autor }) {
  const typZdarzenie = typyZdarzen.typ(sprawa.typ_zdarzenia);
  const html = dokTresc.wezwanieDoUzupelnienia({
    kancelaria: konfiguracja.KANCELARIA,
    spolka,
    typZdarzenie,
    powodWstrzymania,
    odbiorcaNazwa: null,
  });
  const zadajacy = sprawa.zadajacy_osoba_id ? osoby.get(sprawa.zadajacy_osoba_id) : null;

  return wyslijIZapisz(db, {
    sprawaId: sprawa.id,
    spolkaId: spolka.id,
    typ: 'wezwanie',
    odbiorcaOsobaId: sprawa.zadajacy_osoba_id,
    odbiorcaEmail: zadajacy ? zadajacy.email : null,
    temat: `Wezwanie do uzupełnienia — ${spolka.nazwa}`,
    html,
    autor,
  });
}

/**
 * art. 300(34) § 3 KSH — uprzednie powiadomienie osoby, ktorej uprawnienia
 * maja byc wykreslone, zmienione lub obciazone, o tresci zamierzonego wpisu.
 * Wysylane NA ZADANIE pracownika (endpoint `/sprawy/:id/powiadomienie`),
 * przed dokonaniem wpisu - alternatywa dla zgody odnotowanej wprost.
 */
async function powiadomienieUprzednie(db, { sprawa, spolka, odbiorca, podsumowanie, autor }) {
  const typZdarzenie = typyZdarzen.typ(sprawa.typ_zdarzenia);
  const html = dokTresc.powiadomienieZamierzonegoWpisu({
    kancelaria: konfiguracja.KANCELARIA,
    spolka,
    typZdarzenie,
    podsumowanie,
    odbiorcaNazwa: null,
  });

  return wyslijIZapisz(db, {
    sprawaId: sprawa.id,
    spolkaId: spolka.id,
    typ: 'powiadomienie',
    odbiorcaOsobaId: odbiorca.id,
    odbiorcaEmail: odbiorca.email,
    temat: `Powiadomienie o treści zamierzonego wpisu — ${spolka.nazwa}`,
    html,
    autor,
  });
}

module.exports = { poWpisie, poOdmowie, wezwanie, powiadomienieUprzednie, zapiszWydanyDokument };
