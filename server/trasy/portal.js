'use strict';

/**
 * Trasy `/api/psa/portal/...` - portal klienta (sekcja 8 i 9 specyfikacji).
 *
 * Odstepstwo nr 1 z sekcji 2: to jedyna czesc modulu dostepna publicznie.
 * Tozsamosc = konto (`psa_konta`), sesja w osobnym ciasteczku
 * (`pomocnicze/autoryzacja.js`) - nigdy nie miesza sie z sesja pracownika.
 *
 * Swiadome zawezenie wobec opisu w sekcji 9 ("ten sam kreator, ale bez
 * kroku weryfikacji"): krok "co sie zmienia" (krok 3) korzysta w kancelarii
 * z wyszukiwarki calej wspolnej kartoteki `psa_osoby` (`WyborOsoby`) -
 * pokazujaca m.in. status AML innych klientow. Udostepnienie tego
 * wyszukiwania portalowi zdradzaloby dane innych klientow kancelarii, wiec
 * portal zbiera WYLACZNIE krok 1 (typ) i krok 2 (podstawa - opis, dokumenty)
 * i zaklada sprawe w stanie `nowa`; krok "co sie zmienia" i weryfikacje
 * wykonuje pracownik w kokpicie sprawy - dokladnie tak, jak dla zgloszen
 * przyjetych mailem czy papierowo.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const maskowanie = require('../logika/maskowanie');
const przepisy = require('../logika/przepisy');
const typyZdarzen = require('../logika/typy-zdarzen');
const terminy = require('../logika/terminy');
const numery = require('../logika/numery');
const hasla = require('../logika/hasla');
const limiter = require('../logika/limiter');
const dokumentyTresc = require('../logika/dokumenty-tresc');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const { asy, bledneZadanie, nieZnaleziono, nieAutoryzowany } = require('../pomocnicze/odpowiedzi');
const autoryzacja = require('../pomocnicze/autoryzacja');

const router = express.Router();

const TYPY_DOKUMENTU = ['umowa_zbycia', 'uchwala', 'zgoda', 'postanowienie', 'pelnomocnictwo', 'inny'];

function widokKonta(k) {
  if (!k) return null;
  return {
    id: k.id,
    email: k.email,
    rola: k.rola,
    spolka_id: k.spolka_id,
    osoba_id: k.osoba_id,
    ostatnie_logowanie: k.ostatnie_logowanie,
  };
}

function znormalizujEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Czy konto ma dostep do rejestru/spraw wskazanej spolki. */
function maDostepDoSpolki(konto, spolkaId) {
  if (konto.rola === 'spolka') return Number(konto.spolka_id) === Number(spolkaId);
  const wiersz = db()
    .prepare('SELECT 1 FROM psa_stan_akcji WHERE spolka_id = ? AND osoba_id = ? LIMIT 1')
    .get(Number(spolkaId), konto.osoba_id);
  return Boolean(wiersz);
}

function rolaOdbioru(konto) {
  return konto.rola === 'spolka' ? przepisy.ROLE_ODBIORCY.SPOLKA : przepisy.ROLE_ODBIORCY.AKCJONARIUSZ;
}

// ─────────────────────────────────────────────────────────────
// Logowanie
// ─────────────────────────────────────────────────────────────

router.post(
  '/login',
  asy(async (zad, odp) => {
    const email = znormalizujEmail((zad.body || {}).email);
    const haslo = String((zad.body || {}).haslo || '');
    if (!email || !haslo) throw bledneZadanie('Podaj e-mail i hasło.');

    limiter.sprawdz(zad.ip, `portal:${email}`);

    const konto = db().prepare('SELECT * FROM psa_konta WHERE lower(email) = ?').get(email);
    const pasuje = konto ? await hasla.zweryfikuj(haslo, konto.hash_hasla) : false;
    if (!konto || !konto.aktywne || !pasuje) {
      limiter.zanotujNieudana(zad.ip, `portal:${email}`);
      throw nieAutoryzowany('Nieprawidłowy e-mail lub hasło.');
    }

    limiter.wyczyscPoUdanej(zad.ip, `portal:${email}`);
    db().prepare('UPDATE psa_konta SET ostatnie_logowanie = ? WHERE id = ?').run(czas.terazIso(), konto.id);

    autoryzacja.zalogujKonto(zad, odp, konto.id);
    odp.json({ konto: widokKonta({ ...konto, ostatnie_logowanie: czas.terazIso() }) });
  })
);

router.post(
  '/logout',
  asy((zad, odp) => {
    autoryzacja.wylogujKonto(zad, odp);
    odp.json({ ok: true });
  })
);

router.get(
  '/whoami',
  asy((zad, odp) => {
    odp.json({ zalogowany: Boolean(zad.konto), konto: widokKonta(zad.konto) });
  })
);

// Od tego miejsca kazda trasa wymaga zalogowanego konta portalowego.
router.use(autoryzacja.wymagajKonta);

// ─────────────────────────────────────────────────────────────
// Moje spolki / akcje
// ─────────────────────────────────────────────────────────────

router.get(
  '/moje',
  asy((zad, odp) => {
    const konto = zad.konto;

    if (konto.rola === 'spolka') {
      const spolka = rejestr.wczytajSpolke(db(), konto.spolka_id);
      return odp.json({ rola: 'spolka', spolki: spolka ? [{ ...spolka, uwagi: undefined }] : [] });
    }

    const wiersze = db()
      .prepare(
        `SELECT sa.spolka_id, s.nazwa, s.krs, e.seria, sa.nr_od, sa.nr_do, sa.ilosc
           FROM psa_stan_akcji sa
           JOIN psa_spolki s ON s.id = sa.spolka_id
           JOIN psa_emisje e ON e.id = sa.emisja_id
          WHERE sa.osoba_id = ? AND sa.data_do IS NULL AND sa.kategoria = 'akcjonariusz'
          ORDER BY s.nazwa COLLATE NOCASE, e.seria, sa.nr_od`
      )
      .all(konto.osoba_id);

    const grupy = new Map();
    for (const w of wiersze) {
      if (!grupy.has(w.spolka_id)) {
        grupy.set(w.spolka_id, { spolka_id: w.spolka_id, nazwa: w.nazwa, krs: w.krs, razem_akcji: 0, pozycje: [] });
      }
      const g = grupy.get(w.spolka_id);
      g.razem_akcji += w.ilosc;
      g.pozycje.push({ seria: w.seria, ilosc: w.ilosc, numery: numery.opisz([{ nr_od: w.nr_od, nr_do: w.nr_do }]) });
    }

    odp.json({ rola: 'akcjonariusz', spolki: [...grupy.values()] });
  })
);

/** Stan rejestru z maskowaniem wg roli konta (art. 300(35) KSH). */
router.get(
  '/rejestr/:spolkaId',
  asy((zad, odp) => {
    const spolkaId = Number(zad.params.spolkaId);
    if (!maDostepDoSpolki(zad.konto, spolkaId)) {
      throw nieZnaleziono('Nie odnaleziono spółki.');
    }
    const data = zad.query.data ? String(zad.query.data) : czas.dzisIso();
    if (!czas.poprawnaData(data)) throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD.');

    const stan = widoki.widokStanu(db(), spolkaId, data, {
      rola: rolaOdbioru(zad.konto),
      odbiorcaOsobaId: zad.konto.osoba_id,
    });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');
    odp.json(stan);
  })
);

// ─────────────────────────────────────────────────────────────
// Zadania (zlozenie zadania wpisu - kroki 1-2 kreatora)
// ─────────────────────────────────────────────────────────────

function widokSprawyPortal(sprawa, dzis = czas.dzisIso()) {
  const typ = typyZdarzen.istnieje(sprawa.typ_zdarzenia) ? typyZdarzen.typ(sprawa.typ_zdarzenia) : null;
  return {
    id: sprawa.id,
    spolka_id: sprawa.spolka_id,
    typ_zdarzenia: sprawa.typ_zdarzenia,
    typ_nazwa: typ ? typ.nazwa : sprawa.typ_zdarzenia,
    typ_symbol: typ ? typ.symbol : '?',
    zrodlo: sprawa.zrodlo,
    zadajacy_opis: sprawa.zadajacy_opis,
    data_wplywu: sprawa.data_wplywu,
    stan: sprawa.stan,
    powod_odmowy: sprawa.powod_odmowy,
    termin: terminy.policzTermin(sprawa, dzis),
  };
}

router.get(
  '/zadania',
  asy((zad, odp) => {
    const konto = zad.konto;
    const warunek = konto.rola === 'spolka' ? 'sp.spolka_id = ?' : 'sp.zadajacy_osoba_id = ?';
    const parametr = konto.rola === 'spolka' ? konto.spolka_id : konto.osoba_id;

    const wiersze = db()
      .prepare(
        `SELECT sp.*, s.nazwa AS spolka_nazwa
           FROM psa_sprawy sp
           JOIN psa_spolki s ON s.id = sp.spolka_id
          WHERE sp.zrodlo = 'portal' AND ${warunek}
          ORDER BY sp.data_wplywu DESC`
      )
      .all(parametr);

    const dzis = czas.dzisIso();
    odp.json({ sprawy: wiersze.map((s) => ({ ...widokSprawyPortal(s, dzis), spolka_nazwa: s.spolka_nazwa })) });
  })
);

router.post(
  '/zadania',
  asy((zad, odp) => {
    const konto = zad.konto;
    const cialo = zad.body || {};

    const spolkaId = Number(cialo.spolka_id);
    if (!maDostepDoSpolki(konto, spolkaId)) throw bledneZadanie('Nie odnaleziono spółki.');
    const spolka = rejestr.wczytajSpolke(db(), spolkaId);
    if (!spolka) throw bledneZadanie('Nie odnaleziono spółki.');
    if (przepisy.STATUSY_SPOLKI_BLOKUJACE_WPIS.includes(spolka.status)) {
      throw bledneZadanie(`Spółka ma status „${spolka.status}” — nie można zgłosić nowej sprawy.`);
    }

    const typZdarzenia = String(cialo.typ_zdarzenia || '');
    const typ = typyZdarzen
      .dostepneWKreatorze(2)
      .find((t) => t.kod === typZdarzenia && !t.z_urzedu);
    if (!typ) {
      throw bledneZadanie(`Typ zdarzenia „${typZdarzenia}” nie jest dostępny do zgłoszenia przez portal.`);
    }

    const opis = String(cialo.opis || '').trim();
    if (!opis) throw bledneZadanie('Opisz, czego dotyczy zgłoszenie.');

    const dataWplywu = czas.terazIso();
    const dane = {
      spolka_id: spolkaId,
      typ_zdarzenia: typZdarzenia,
      zrodlo: 'portal',
      zadajacy_osoba_id: konto.osoba_id,
      zadajacy_opis: konto.rola === 'spolka' ? `${spolka.nazwa} (zgłoszenie przez portal)` : opis,
      data_wplywu: dataWplywu,
      stan: 'nowa',
      wymaga_powiadomienia: typ.wymaga_powiadomienia === true ? 1 : 0,
      autor: `Portal — ${konto.email}`,
      notatka: opis,
      utworzono: czas.terazIso(),
    };
    dane.termin_do = terminy.policzTermin(
      { data_wplywu: dataWplywu.slice(0, 10), stan: 'nowa', wstrzymana_od: null, wznowiona_od: null },
      czas.dzisIso()
    ).termin_do;

    const kolumny = Object.keys(dane);
    const wynik = db()
      .prepare(`INSERT INTO psa_sprawy (${kolumny.join(', ')}) VALUES (${kolumny.map((k) => `@${k}`).join(', ')})`)
      .run(dane);

    const sprawa = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(wynik.lastInsertRowid);
    odp.status(201).json({ sprawa: widokSprawyPortal(sprawa) });
  })
);

// ─────────────────────────────────────────────────────────────
// Dokumenty do wlasnej sprawy (upload z portalu)
// ─────────────────────────────────────────────────────────────

const ROZSZERZENIA_DOZWOLONE = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']);
const LIMIT_ROZMIARU_BAJTY = 20 * 1024 * 1024;

function katalogSprawy(spolkaId, sprawaId) {
  return path.join(konfiguracja.KATALOG_DOKUMENTOW, `spolka_${spolkaId}`, `sprawa_${sprawaId}`);
}

const upload = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const sprawa = zad.psaSprawa;
      const katalog = katalogSprawy(sprawa.spolka_id, sprawa.id);
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      const bezpiecznaNazwa = path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_');
      wywolaj(null, `${crypto.randomUUID()}-${bezpiecznaNazwa}`);
    },
  }),
  limits: { fileSize: LIMIT_ROZMIARU_BAJTY, files: 10 },
  fileFilter(zad, plik, wywolaj) {
    const rozszerzenie = path.extname(plik.originalname).toLowerCase();
    if (!ROZSZERZENIA_DOZWOLONE.has(rozszerzenie)) {
      return wywolaj(
        new Error(`Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Dozwolone: ${[...ROZSZERZENIA_DOZWOLONE].join(', ')}.`)
      );
    }
    wywolaj(null, true);
  },
});

/** Wstrzykuje sprawe do `zad` PRZED multerem, sprawdzajac wlasnosc. */
function zaladujWlasnaSprawe(zad, odp, dalej) {
  const sprawa = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(Number(zad.params.id));
  if (!sprawa || sprawa.zrodlo !== 'portal') return dalej(nieZnaleziono('Nie odnaleziono sprawy.'));

  const konto = zad.konto;
  const wlasciciel =
    konto.rola === 'spolka'
      ? Number(sprawa.spolka_id) === Number(konto.spolka_id)
      : Number(sprawa.zadajacy_osoba_id) === Number(konto.osoba_id);
  if (!wlasciciel) return dalej(nieZnaleziono('Nie odnaleziono sprawy.'));

  zad.psaSprawa = sprawa;
  dalej();
}

router.post(
  '/zadania/:id/dokumenty',
  zaladujWlasnaSprawe,
  (zad, odp, dalej) => upload.array('pliki', 10)(zad, odp, (e) => (e ? dalej(bledneZadanie(e.message)) : dalej())),
  asy((zad, odp) => {
    const sprawa = zad.psaSprawa;
    const konto = zad.konto;
    const typDokumentu = String(zad.body.typ_dokumentu || 'inny');
    if (!TYPY_DOKUMENTU.includes(typDokumentu)) throw bledneZadanie(`Nieznany typ dokumentu: „${typDokumentu}”.`);
    const pliki = zad.files || [];
    if (pliki.length === 0) throw bledneZadanie('Nie przesłano żadnego pliku.');

    const wstaw = db().prepare(
      `INSERT INTO psa_dokumenty (sprawa_id, nazwa_pliku, sciezka, mime, rozmiar, typ_dokumentu, hash, wgral, utworzono)
       VALUES (@sprawa_id, @nazwa_pliku, @sciezka, @mime, @rozmiar, @typ_dokumentu, @hash, @wgral, @utworzono)`
    );
    const zapisane = pliki.map((plik) => {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(plik.path)).digest('hex');
      const wynik = wstaw.run({
        sprawa_id: sprawa.id,
        nazwa_pliku: plik.originalname,
        sciezka: path.relative(konfiguracja.KATALOG_DOKUMENTOW, plik.path),
        mime: plik.mimetype,
        rozmiar: plik.size,
        typ_dokumentu: typDokumentu,
        hash,
        wgral: `Portal — ${konto.email}`,
        utworzono: czas.terazIso(),
      });
      return { id: Number(wynik.lastInsertRowid), nazwa_pliku: plik.originalname, rozmiar: plik.size };
    });

    odp.status(201).json({ dokumenty: zapisane });
  })
);

// ─────────────────────────────────────────────────────────────
// Informacja z rejestru (art. 300(35) KSH)
// ─────────────────────────────────────────────────────────────

router.post(
  '/informacja',
  asy((zad, odp) => {
    const konto = zad.konto;
    const spolkaId = Number((zad.body || {}).spolka_id);
    if (!maDostepDoSpolki(konto, spolkaId)) throw nieZnaleziono('Nie odnaleziono spółki.');

    const data = (zad.body || {}).data ? String((zad.body || {}).data) : czas.dzisIso();
    if (!czas.poprawnaData(data)) throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD.');

    const stan = widoki.widokStanu(db(), spolkaId, data, {
      rola: rolaOdbioru(konto),
      odbiorcaOsobaId: konto.osoba_id,
    });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');

    const trescHtml = dokumentyTresc.informacjaZRejestru({
      kancelaria: konfiguracja.KANCELARIA,
      spolka: stan.spolka,
      data,
      stan,
    });

    db()
      .prepare(
        `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html, wyslano, autor, utworzono)
         VALUES (?, 'informacja_z_rejestru', ?, 'portal', ?, ?, ?, ?)`
      )
      .run(spolkaId, konto.osoba_id, trescHtml, czas.terazIso(), `Portal — ${konto.email}`, czas.terazIso());

    odp.json({ tresc_html: trescHtml });
  })
);

module.exports = router;
