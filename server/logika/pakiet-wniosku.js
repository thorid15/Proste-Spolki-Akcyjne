'use strict';

/**
 * Komplet dokumentów wniosku na dysku i w bazie — wystawianie, poprawianie
 * treści, udostępnianie klientowi.
 *
 * Kto i kiedy wystawia dokumenty
 * ──────────────────────────────
 * Dawniej komplet powstawał SAM, w chwili złożenia wniosku, i od razu trafiał
 * do portalu klienta. Wniosek złożony z błędnymi danymi dawał więc błędną
 * umowę — klient dostawał ją do podpisu, podpisywał i odsyłał, a błąd
 * wychodził dopiero przy weryfikacji, gdy wszystko trzeba było powtórzyć.
 *
 * Teraz złożenie wniosku niczego nie generuje. Dokumenty wystawia KANCELARIA
 * (`POST /api/psa/wnioski/:id/dokumenty/wystaw`), po sprawdzeniu danych;
 * może poprawić treść każdego z nich, a dopiero świadome „Udostępnij
 * klientowi" wpuszcza komplet do portalu. Portal klienta pokazuje wyłącznie
 * pozycje z wypełnioną kolumną `udostepniono`.
 *
 * Treść żyje jako lista bloków (`logika/bloki-dokumentu.js`) w kolumnie
 * `tresc_bloki`; PDF jest jej wynikiem, nie źródłem — dlatego po każdej
 * poprawce składa się go od nowa i podmienia plik w miejscu.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { db } = require('../baza');
const konfiguracja = require('../konfiguracja');
const ustawienia = require('./ustawienia');
const czas = require('../pomocnicze/czas');
const dokumentyWniosku = require('./dokumenty-wniosku');
const bloki = require('./bloki-dokumentu');
const formyPodpisu = require('./formy-podpisu');

/** Kolumny listy dokumentów — bez ścieżek, które nie mają czego szukać w API. */
const KOLUMNY_WIDOKU = `id, typ, nazwa, nazwa_pliku, rozmiar, akcjonariusz_id, kolejnosc,
        utworzono, zmodyfikowano, zmodyfikowal, udostepniono, brakujace,
        sprawdzono, sprawdzil,
        podpis_nazwa_pliku, podpis_rozmiar, podpis_wgrano,
        podpis_potwierdzono, podpis_potwierdzil, podpis_hash,
        otwarto_w_portalu,
        id_dokumentu, oryginal_sha256, oryginal_dlugosc,
        walidacja_wynik, walidacja_typ, walidacja_json, walidacja_kiedy,
        forma_podpisu, oryginal_otrzymano, oryginal_poczta_zadeklarowano,
        notariusz_podpis_wgrano, notariusz_walidacja_wynik, notariusz_walidacja_json,
        (tresc_bloki IS NOT NULL) AS edytowalny`;

function katalogWniosku(wniosekId) {
  return path.join(konfiguracja.KATALOG_DOKUMENTOW, 'wnioski', `wniosek_${wniosekId}`);
}

function katalogDokumentow(wniosekId) {
  return path.join(katalogWniosku(wniosekId), 'oswiadczenia');
}

function przeliczBrakujace(surowe) {
  if (!surowe) return [];
  try {
    const lista = JSON.parse(surowe);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function widokDokumentu(wiersz) {
  if (!wiersz) return null;
  const zJson = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };
  const { walidacja_json: wj, notariusz_walidacja_json: nj, ...reszta } = wiersz;
  return {
    ...reszta,
    edytowalny: Boolean(wiersz.edytowalny),
    brakujace: przeliczBrakujace(wiersz.brakujace),
    walidacja: zJson(wj),
    notariusz_walidacja: zJson(nj),
    // W2.1 — formy dopuszczalne dla tego dokumentu (jedno źródło: formy-podpisu.js).
    formy_dopuszczalne: formyPodpisu.regula(formyPodpisu.typDlaDokumentuWniosku(wiersz.typ)).formy
      .map((kod) => ({ kod, nazwa: formyPodpisu.NAZWY_FORM[kod] })),
  };
}

/**
 * Lista dokumentów wniosku.
 *
 * @param {number} wniosekId
 * @param {{tylkoUdostepnione?: boolean}} [opcje]
 */
function lista(wniosekId, { tylkoUdostepnione = false } = {}) {
  const warunek = tylkoUdostepnione ? ' AND udostepniono IS NOT NULL' : '';
  return db()
    .prepare(
      `SELECT ${KOLUMNY_WIDOKU}
         FROM psa_wnioski_dokumenty
        WHERE wniosek_id = ?${warunek}
        ORDER BY kolejnosc, id`
    )
    .all(wniosekId)
    .map(widokDokumentu);
}

function dokument(wniosekId, dokumentId) {
  return db()
    .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ?')
    .get(Number(dokumentId), Number(wniosekId));
}

/**
 * Ślad pierwszego otwarcia dokumentu przez KLIENTA w portalu (B6). Ustawia
 * się RAZ — kolejne pobrania tego samego pliku nic nie zmieniają, więc
 * moment w bazie mówi wyłącznie „kiedy klient zobaczył to po raz pierwszy”,
 * przydatne też jako ślad doręczenia (WDROZENIE-PSA.md § 1).
 */
function oznaczOtwarte(wniosekId, dokumentId) {
  db()
    .prepare(
      `UPDATE psa_wnioski_dokumenty SET otwarto_w_portalu = ?
        WHERE id = ? AND wniosek_id = ? AND otwarto_w_portalu IS NULL`
    )
    .run(czas.terazIso(), Number(dokumentId), Number(wniosekId));
}

/** Treść dokumentu do edytora — bloki, nie plik. */
function tresc(wniosekId, dokumentId) {
  const wiersz = dokument(wniosekId, dokumentId);
  if (!wiersz) return null;
  let lista_blokow = [];
  try {
    lista_blokow = wiersz.tresc_bloki ? JSON.parse(wiersz.tresc_bloki) : [];
  } catch {
    lista_blokow = [];
  }
  return {
    id: wiersz.id,
    typ: wiersz.typ,
    nazwa: wiersz.nazwa,
    nazwa_pliku: wiersz.nazwa_pliku,
    udostepniono: wiersz.udostepniono,
    zmodyfikowano: wiersz.zmodyfikowano,
    sprawdzono: wiersz.sprawdzono,
    // Po odesłaniu podpisanego skanu treści nie wolno już ruszać: podpis
    // dotyczy TEGO brzmienia dokumentu, a nie następnego.
    podpisany: Boolean(wiersz.podpis_sciezka),
    brakujace: przeliczBrakujace(wiersz.brakujace),
    bloki: lista_blokow,
  };
}

function zapiszPlik(wniosekId, plik) {
  const katalog = katalogDokumentow(wniosekId);
  fs.mkdirSync(katalog, { recursive: true });
  // Nazwa NA DYSKU jest techniczna (UUID), żeby nie zależeć od znaków
  // w nazwisku; nazwa widoczna dla klienta siedzi w kolumnie.
  const pelna = path.join(katalog, `${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(pelna, plik);
  return path.relative(konfiguracja.KATALOG_DOKUMENTOW, pelna);
}

function usunPlik(sciezkaWzgledna) {
  if (!sciezkaWzgledna) return;
  const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, sciezkaWzgledna);
  if (pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW)) fs.rmSync(pelna, { force: true });
}

/**
 * Wystawia komplet dokumentów wniosku na podstawie AKTUALNYCH danych.
 *
 * Wywołana ponownie nadpisuje poprzedni komplet — wniosek poprawiony po
 * weryfikacji ma mieć dokumenty z danych, które klient faktycznie zobaczy,
 * a nie dwa różne zestawy. Wraz z nimi znikają wgrane skany: dotyczyły
 * NIEAKTUALNYCH już treści, więc ich zachowanie sugerowałoby, że podpisano
 * to, co leży teraz na ekranie.
 *
 * @param {object} wniosek wiersz `psa_wnioski`
 * @param {object[]} akcjonariusze wiersze `psa_wnioski_akcjonariusze`
 * @returns {Promise<{dokumenty: object[], sciezkaUmowy: string|null}>}
 */
/** Unikalne ID dokumentu do podpisu — drukowane w stopce PDF (W3.1). */
function nowyIdentyfikator(wniosekId) {
  return `PSA-W${wniosekId}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Skrót i długość oryginału (W3.4) + kontrola limitu mObywatela (W3.1). */
function odciskOryginalu(plik, nazwa) {
  if (plik.length > konfiguracja.PODPIS.limit_bajtow) {
    throw new Error(
      `Dokument „${nazwa}” ma ${(plik.length / 1048576).toFixed(1)} MB — więcej niż limit podpisu w mObywatelu `
        + `(${(konfiguracja.PODPIS.limit_bajtow / 1048576).toFixed(0)} MB). Skróć treść albo podziel dokument.`
    );
  }
  return {
    oryginal_sha256: crypto.createHash('sha256').update(plik).digest('hex'),
    oryginal_dlugosc: plik.length,
  };
}

async function wystaw(wniosek, akcjonariusze) {
  const pakiet = dokumentyWniosku.zlozPakiet({
    wniosek,
    akcjonariusze,
    dzis: czas.dzisIso(),
    // W7.4 — wniosek przeniesienia rejestru: umowa z klauzulą warunkową.
    przeniesienie: require('../przeniesienia').dlaWniosku(db(), wniosek),
  });

  // Pliki składamy PRZED kasowaniem poprzedniego kompletu: gdyby składanie
  // się wywróciło, klient ma zostać z tym, co miał, a nie z pustą listą.
  const zlozone = [];
  for (const d of pakiet) {
    const identyfikator = nowyIdentyfikator(wniosek.id);
    const plik = await dokumentyWniosku.zloz(d, { identyfikator });
    zlozone.push({ opis: d, plik, identyfikator, odcisk: odciskOryginalu(plik, d.nazwa) });
  }

  const katalog = katalogDokumentow(wniosek.id);
  fs.rmSync(katalog, { recursive: true, force: true });
  fs.mkdirSync(katalog, { recursive: true });

  const teraz = czas.terazIso();
  db().prepare('DELETE FROM psa_wnioski_dokumenty WHERE wniosek_id = ?').run(wniosek.id);

  let sciezkaUmowy = null;
  const wstaw = db().prepare(
    `INSERT INTO psa_wnioski_dokumenty
       (wniosek_id, akcjonariusz_id, typ, nazwa, nazwa_pliku, sciezka, mime,
        rozmiar, kolejnosc, tresc_bloki, brakujace, utworzono,
        id_dokumentu, oryginal_sha256, oryginal_dlugosc)
     VALUES (@wniosek_id, @akcjonariusz_id, @typ, @nazwa, @nazwa_pliku, @sciezka,
             'application/pdf', @rozmiar, @kolejnosc, @tresc_bloki, @brakujace, @utworzono,
             @id_dokumentu, @oryginal_sha256, @oryginal_dlugosc)`
  );

  for (const { opis, plik, identyfikator, odcisk } of zlozone) {
    const sciezka = zapiszPlik(wniosek.id, plik);
    if (opis.typ === dokumentyWniosku.TYPY.UMOWA_REJESTRU) sciezkaUmowy = sciezka;
    wstaw.run({
      wniosek_id: wniosek.id,
      akcjonariusz_id: opis.akcjonariuszId,
      typ: opis.typ,
      nazwa: opis.nazwa,
      nazwa_pliku: opis.nazwaPliku,
      sciezka,
      rozmiar: plik.length,
      kolejnosc: opis.kolejnosc,
      tresc_bloki: JSON.stringify(opis.bloki),
      brakujace: JSON.stringify(opis.brakujace || []),
      utworzono: teraz,
      id_dokumentu: identyfikator,
      ...odcisk,
    });
  }

  // Ścieżka projektu umowy zostaje na wniosku: prowadzi ona cały przebieg
  // (umowa_wygenerowana → umowa_podpisana).
  if (sciezkaUmowy) {
    db()
      .prepare(
        `UPDATE psa_wnioski
            SET umowa_projekt_sciezka = ?, umowa_projekt_wygenerowano = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(sciezkaUmowy, teraz, teraz, wniosek.id);
  }

  return { dokumenty: lista(wniosek.id), sciezkaUmowy };
}

/**
 * Zapisuje poprawioną treść JEDNEGO dokumentu i składa go od nowa.
 * Plik podmienia się w miejscu — klient, kancelaria i akta spółki widzą
 * zawsze tę samą, ostatnią wersję.
 *
 * @returns {Promise<object>} widok dokumentu po zmianie
 */
async function zapiszTresc(wniosekId, dokumentId, noweBloki, autor) {
  const wiersz = dokument(wniosekId, dokumentId);
  if (!wiersz) return null;
  if (wiersz.podpis_sciezka) {
    throw new Error('Dokument został już podpisany — jego treści nie można zmieniać.');
  }

  const znormalizowane = bloki.znormalizuj(noweBloki);
  const identyfikator = wiersz.id_dokumentu || nowyIdentyfikator(wniosekId);
  const plik = await bloki.doPdf(znormalizowane, {
    tytul: dokumentyWniosku.NAZWY[wiersz.typ] || wiersz.nazwa,
    autor: ustawienia.kancelaria(db()).nazwa,
    identyfikator,
  });
  const odcisk = odciskOryginalu(plik, wiersz.nazwa);

  const sciezka = zapiszPlik(wniosekId, plik);
  const teraz = czas.terazIso();
  // Zapis treści JEST sprawdzeniem: pracownik doszedł do przycisku, więc
  // dokument przeczytał — niezależnie od tego, czy coś w nim poprawił.
  // Znacznik zmiany zostaje osobno, bo dokument poprawiony ręcznie i dokument
  // tylko przeczytany to dla akt dwie różne rzeczy.
  const zmieniono = JSON.stringify(znormalizowane) !== String(wiersz.tresc_bloki || '');
  db()
    .prepare(
      `UPDATE psa_wnioski_dokumenty
          SET sciezka = ?, rozmiar = ?, tresc_bloki = ?,
              zmodyfikowano = ?, zmodyfikowal = ?, sprawdzono = ?, sprawdzil = ?,
              id_dokumentu = ?, oryginal_sha256 = ?, oryginal_dlugosc = ?
        WHERE id = ?`
    )
    .run(
      sciezka, plik.length, JSON.stringify(znormalizowane),
      zmieniono ? teraz : wiersz.zmodyfikowano,
      zmieniono ? (autor || null) : wiersz.zmodyfikowal,
      teraz, autor || null,
      identyfikator, odcisk.oryginal_sha256, odcisk.oryginal_dlugosc,
      wiersz.id
    );
  usunPlik(wiersz.sciezka);

  if (wiersz.typ === dokumentyWniosku.TYPY.UMOWA_REJESTRU) {
    db()
      .prepare('UPDATE psa_wnioski SET umowa_projekt_sciezka = ?, zaktualizowano = ? WHERE id = ?')
      .run(sciezka, teraz, wniosekId);
  }

  return tresc(wniosekId, dokumentId);
}

/**
 * Udostępnia komplet klientowi. Od tej chwili pozycje widać w portalu
 * i można przy nich odsyłać podpisane skany.
 *
 * @returns {object[]} lista dokumentów po udostępnieniu
 */
/**
 * Potwierdzenie, że odesłany skan jest kompletny i prawidłowo podpisany.
 * Samo wgranie pliku tego nie przesądza — ktoś musi na niego spojrzeć,
 * a przyjęcie wniosku tego wymaga.
 *
 * @returns {object|null} widok dokumentu po zmianie; `null` gdy nie ma takiego
 *   dokumentu, `false` gdy nie odesłano jeszcze skanu
 */
class BladPodpisu extends Error {}

const FORMY_ELEKTRONICZNE = [formyPodpisu.FORMY.QES, formyPodpisu.FORMY.PZ, formyPodpisu.FORMY.PO];

/**
 * @param {{forma?: string, oryginalOtrzymano?: string}} [opcje] — forma podpisu
 *   wskazana przez pracownika (W2.1). Oryginał papierowy: data otrzymania
 *   i rodzaj podpisu (zwykły / notarialnie poświadczony / w kancelarii).
 */
function potwierdzPodpis(wniosekId, dokumentId, potwierdzono, autor, { forma = null, oryginalOtrzymano = null } = {}) {
  const wiersz = dokument(wniosekId, dokumentId);
  if (!wiersz) return null;

  if (potwierdzono) {
    // D-087: pracownik nie musi wskazywać formy — potwierdza, że podpis jest w porządku.
    // Plik z podpisem → podpis elektroniczny; bez pliku → oryginał papierowy (data otrzymania).
    // Forma podana wprost (API) nadal jest sprawdzana z tabelą § 2.
    const typ = formyPodpisu.typDlaDokumentuWniosku(wiersz.typ);
    const wybrana = forma || null;
    if (wybrana) {
      const ocena = formyPodpisu.ocenForme(typ, wybrana);
      if (!ocena.dopuszczalna) throw new BladPodpisu(ocena.przyczyna);
    }
    if (wybrana ? FORMY_ELEKTRONICZNE.includes(wybrana) : Boolean(wiersz.podpis_sciezka)) {
      if (!wiersz.podpis_sciezka) return false;
    } else {
      const dzien = oryginalOtrzymano || czas.dzisIso();
      if (!czas.poprawnaData(dzien)) throw new BladPodpisu('Data otrzymania oryginału musi mieć format RRRR-MM-DD.');
      db().prepare('UPDATE psa_wnioski_dokumenty SET oryginal_otrzymano = ? WHERE id = ?').run(dzien, wiersz.id);
    }
    db().prepare('UPDATE psa_wnioski_dokumenty SET forma_podpisu = ? WHERE id = ?').run(wybrana, wiersz.id);
  } else if (!wiersz.podpis_sciezka && !wiersz.oryginal_otrzymano) {
    return false;
  }

  if (!wiersz.podpis_sciezka) {
    db()
      .prepare('UPDATE psa_wnioski_dokumenty SET podpis_potwierdzono = ?, podpis_potwierdzil = ?, podpis_hash = NULL WHERE id = ?')
      .run(potwierdzono ? czas.terazIso() : null, potwierdzono ? autor || null : null, wiersz.id);
    return widokDokumentu(db().prepare(`SELECT ${KOLUMNY_WIDOKU} FROM psa_wnioski_dokumenty WHERE id = ?`).get(wiersz.id));
  }

  // Skrot tresci PLIKU NA DYSKU w chwili potwierdzenia — dokumentuje, co
  // dokladnie kancelaria zaakceptowala (Z-205). Trasa portalu, ktora
  // przyjmuje skany, odrzuca kazda probe podmiany tego pliku, gdy
  // podpis_potwierdzono jest juz wypelnione — skrot jest wiec zapisem
  // faktu, a nie jedynym zabezpieczeniem.
  const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, wiersz.podpis_sciezka);
  const skrot = potwierdzono && pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) && fs.existsSync(pelnaSciezka)
    ? crypto.createHash('sha256').update(fs.readFileSync(pelnaSciezka)).digest('hex')
    : null;

  db()
    .prepare(
      'UPDATE psa_wnioski_dokumenty SET podpis_potwierdzono = ?, podpis_potwierdzil = ?, podpis_hash = ? WHERE id = ?'
    )
    .run(potwierdzono ? czas.terazIso() : null, potwierdzono ? autor || null : null, skrot, wiersz.id);

  return widokDokumentu(
    db().prepare(`SELECT ${KOLUMNY_WIDOKU} FROM psa_wnioski_dokumenty WHERE id = ?`).get(wiersz.id)
  );
}

/** Pozycje, które jeszcze nie mają potwierdzonego podpisu — blokują przyjęcie. */
function bezPotwierdzonegoPodpisu(wniosekId) {
  return db()
    .prepare(
      `SELECT nazwa, nazwa_pliku, (podpis_sciezka IS NOT NULL) AS ma_skan
         FROM psa_wnioski_dokumenty
        WHERE wniosek_id = ? AND podpis_potwierdzono IS NULL
        ORDER BY kolejnosc, id`
    )
    .all(wniosekId)
    .map((d) => ({ ...d, ma_skan: Boolean(d.ma_skan) }));
}

function udostepnij(wniosekId) {
  const teraz = czas.terazIso();
  db()
    .prepare('UPDATE psa_wnioski_dokumenty SET udostepniono = ? WHERE wniosek_id = ? AND udostepniono IS NULL')
    .run(teraz, wniosekId);
  return lista(wniosekId);
}

module.exports = {
  BladPodpisu,
  KOLUMNY_WIDOKU,
  katalogWniosku,
  lista,
  dokument,
  oznaczOtwarte,
  tresc,
  wystaw,
  zapiszTresc,
  potwierdzPodpis,
  bezPotwierdzonegoPodpisu,
  udostepnij,
  widokDokumentu,
};
