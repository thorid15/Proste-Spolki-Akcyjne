'use strict';

/**
 * Trasy `/api/psa/auth/...` - logowanie pracownikow kancelarii
 * (odstepstwo nr 2 z sekcji 2 specyfikacji).
 */

const express = require('express');

const { db } = require('../baza');
const hasla = require('../logika/hasla');
const limiter = require('../logika/limiter');
const czas = require('../pomocnicze/czas');
const { asy, bledneZadanie, nieZnaleziono, nieAutoryzowany } = require('../pomocnicze/odpowiedzi');
const autoryzacja = require('../pomocnicze/autoryzacja');

const router = express.Router();

function widokUzytkownika(u) {
  if (!u) return null;
  return {
    id: u.id,
    imie: u.imie,
    email: u.email,
    rola: u.rola,
    aktywny: Boolean(u.aktywny),
    // D-Z: domyslna osoba dzialajaca przy wpisach tego pracownika.
    osoba_dzialajaca_id: u.osoba_dzialajaca_id ?? null,
    ostatnie_logowanie: u.ostatnie_logowanie,
    utworzono: u.utworzono,
  };
}

function znormalizujEmail(email) {
  return String(email || '').trim().toLowerCase();
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

    limiter.sprawdz(zad.ip, email);

    const uzytkownik = db()
      .prepare('SELECT * FROM psa_uzytkownicy WHERE lower(email) = ?')
      .get(email);

    const pasuje = uzytkownik ? await hasla.zweryfikuj(haslo, uzytkownik.hash_hasla) : false;
    if (!uzytkownik || !uzytkownik.aktywny || !pasuje) {
      limiter.zanotujNieudana(zad.ip, email);
      throw nieAutoryzowany('Nieprawidłowy e-mail lub hasło.');
    }

    limiter.wyczyscPoUdanej(zad.ip, email);
    db()
      .prepare('UPDATE psa_uzytkownicy SET ostatnie_logowanie = ? WHERE id = ?')
      .run(czas.terazIso(), uzytkownik.id);

    autoryzacja.zalogujPracownika(zad, odp, uzytkownik.id);
    odp.json({ uzytkownik: widokUzytkownika({ ...uzytkownik, ostatnie_logowanie: czas.terazIso() }) });
  })
);

router.post(
  '/logout',
  asy((zad, odp) => {
    autoryzacja.wylogujPracownika(zad, odp);
    odp.json({ ok: true });
  })
);

/** Zawsze 200 - front pyta przy starcie aplikacji, brak sesji nie jest bledem. */
router.get(
  '/whoami',
  asy((zad, odp) => {
    odp.json({ zalogowany: Boolean(zad.uzytkownik), uzytkownik: widokUzytkownika(zad.uzytkownik) });
  })
);

router.post(
  '/zmiana-hasla',
  autoryzacja.wymagajPracownika,
  asy(async (zad, odp) => {
    const { haslo_obecne, haslo_nowe } = zad.body || {};
    if (!haslo_obecne || !haslo_nowe) throw bledneZadanie('Podaj obecne i nowe hasło.');

    const pasuje = await hasla.zweryfikuj(haslo_obecne, zad.uzytkownik.hash_hasla);
    if (!pasuje) throw bledneZadanie('Obecne hasło jest nieprawidłowe.');

    const ocena = hasla.ocenSile(haslo_nowe);
    if (!ocena.ok) throw bledneZadanie(ocena.powod);

    const nowyHash = await hasla.hashuj(haslo_nowe);
    db().prepare('UPDATE psa_uzytkownicy SET hash_hasla = ? WHERE id = ?').run(nowyHash, zad.uzytkownik.id);
    // Zmiana hasla uniewaznia WSZYSTKIE dotychczasowe tokeny tego konta,
    // na kazdym urzadzeniu, natychmiast (Z-251) — wlacznie z tym, ktorym
    // zostalo wlasnie wywolane to zadanie (uzytkownik zaloguje sie ponownie).
    autoryzacja.uniewaznijWszystkieTokeny('pracownik', zad.uzytkownik.id);
    odp.json({ ok: true });
  })
);

// ─────────────────────────────────────────────────────────────
// Zarzadzanie pracownikami (tylko admin)
// ─────────────────────────────────────────────────────────────

router.get(
  '/uzytkownicy',
  autoryzacja.wymagajAdmina,
  asy((zad, odp) => {
    const wiersze = db().prepare('SELECT * FROM psa_uzytkownicy ORDER BY imie COLLATE NOCASE').all();
    odp.json({ uzytkownicy: wiersze.map(widokUzytkownika) });
  })
);

router.post(
  '/uzytkownicy',
  autoryzacja.wymagajAdmina,
  asy(async (zad, odp) => {
    const { imie, email, rola, haslo } = zad.body || {};
    if (!imie || !String(imie).trim()) throw bledneZadanie('Podaj imię i nazwisko.');
    const emailCzysty = znormalizujEmail(email);
    if (!emailCzysty || !emailCzysty.includes('@')) throw bledneZadanie('Podaj poprawny e-mail.');
    if (!['admin', 'pracownik'].includes(rola)) throw bledneZadanie('Rola musi być „admin” albo „pracownik”.');

    const hasloOstateczne = haslo && String(haslo).trim() ? String(haslo) : hasla.losoweHaslo();
    if (haslo && String(haslo).trim()) {
      const ocena = hasla.ocenSile(haslo);
      if (!ocena.ok) throw bledneZadanie(ocena.powod);
    }

    const hash = await hasla.hashuj(hasloOstateczne);
    try {
      const wynik = db()
        .prepare(
          `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
           VALUES (?, ?, ?, ?, 1, ?)`
        )
        .run(String(imie).trim(), emailCzysty, hash, rola, czas.terazIso());

      odp.status(201).json({
        uzytkownik: widokUzytkownika(db().prepare('SELECT * FROM psa_uzytkownicy WHERE id = ?').get(wynik.lastInsertRowid)),
        // Haslo tymczasowe pokazujemy JEDEN raz w odpowiedzi - podobnie jak przy
        // bootstrapie admina - zeby dalo sie je przekazac nowemu pracownikowi.
        haslo_tymczasowe: haslo && String(haslo).trim() ? null : hasloOstateczne,
      });
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw bledneZadanie('Użytkownik z tym adresem e-mail już istnieje.');
      }
      throw e;
    }
  })
);

router.patch(
  '/uzytkownicy/:id',
  autoryzacja.wymagajAdmina,
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const docelowy = db().prepare('SELECT * FROM psa_uzytkownicy WHERE id = ?').get(id);
    if (!docelowy) throw nieZnaleziono('Nie odnaleziono użytkownika.');

    const { aktywny, rola, osoba_dzialajaca_id: osobaDzialajacaId } = zad.body || {};
    if (aktywny !== undefined && id === zad.uzytkownik.id && !aktywny) {
      throw bledneZadanie('Nie możesz dezaktywować własnego konta.');
    }
    if (rola !== undefined && !['admin', 'pracownik'].includes(rola)) {
      throw bledneZadanie('Rola musi być „admin” albo „pracownik”.');
    }

    const zmiany = {};
    if (aktywny !== undefined) zmiany.aktywny = aktywny ? 1 : 0;
    if (rola !== undefined) zmiany.rola = rola;
    if (osobaDzialajacaId !== undefined) {
      if (osobaDzialajacaId !== null
        && !db().prepare('SELECT id FROM psa_osoby_dzialajace WHERE id = ? AND aktywny = 1').get(Number(osobaDzialajacaId))) {
        throw bledneZadanie('Wskazana osoba działająca nie istnieje albo jest nieaktywna.');
      }
      zmiany.osoba_dzialajaca_id = osobaDzialajacaId === null ? null : Number(osobaDzialajacaId);
    }
    if (Object.keys(zmiany).length === 0) throw bledneZadanie('Nie wskazano zmian.');

    db()
      .prepare(`UPDATE psa_uzytkownicy SET ${Object.keys(zmiany).map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`)
      .run({ ...zmiany, id });

    odp.json({ uzytkownik: widokUzytkownika(db().prepare('SELECT * FROM psa_uzytkownicy WHERE id = ?').get(id)) });
  })
);

router.post(
  '/uzytkownicy/:id/reset-hasla',
  autoryzacja.wymagajAdmina,
  asy(async (zad, odp) => {
    const id = Number(zad.params.id);
    const docelowy = db().prepare('SELECT * FROM psa_uzytkownicy WHERE id = ?').get(id);
    if (!docelowy) throw nieZnaleziono('Nie odnaleziono użytkownika.');

    const nowe = hasla.losoweHaslo();
    const hash = await hasla.hashuj(nowe);
    db().prepare('UPDATE psa_uzytkownicy SET hash_hasla = ? WHERE id = ?').run(hash, id);
    autoryzacja.uniewaznijWszystkieTokeny('pracownik', id);
    odp.json({ ok: true, haslo_tymczasowe: nowe });
  })
);

// ─────────────────────────────────────────────────────────────
// Bootstrap administratora - wywolywane raz przy starcie serwera
// ─────────────────────────────────────────────────────────────

/**
 * Jesli tabela pracownikow jest pusta, zaklada konto admina z `ADMIN_EMAIL`
 * i losowym haslem, wypisanym JEDEN raz na konsole. Sekcja 5: "Admin = Lukasz
 * (env ADMIN_EMAIL)". Idempotentne - drugi start nic nie robi.
 */
async function zapewnijAdmina(baza, adminEmail) {
  const ile = baza.prepare('SELECT COUNT(*) AS ile FROM psa_uzytkownicy').get().ile;
  if (ile > 0) return;

  if (!adminEmail) {
    console.warn(
      '[psa] Brak kont pracowników i brak ADMIN_EMAIL — nikt nie może się zalogować. ' +
        'Ustaw ADMIN_EMAIL w .env i zrestartuj serwer.'
    );
    return;
  }

  const hasloTymczasowe = hasla.losoweHaslo();
  const hash = await hasla.hashuj(hasloTymczasowe);
  baza
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Administrator', ?, ?, 'admin', 1, ?)`
    )
    .run(znormalizujEmail(adminEmail), hash, czas.terazIso());

  console.log('[psa] ══════════════════════════════════════════════════════════════');
  console.log(`[psa] Utworzono konto administratora: ${znormalizujEmail(adminEmail)}`);
  console.log(`[psa] Hasło tymczasowe: ${hasloTymczasowe}`);
  console.log('[psa] Zapisz je teraz — zmień po pierwszym logowaniu. Nie zostanie ponownie wyświetlone.');
  console.log('[psa] ══════════════════════════════════════════════════════════════');
}

module.exports = router;
// ─────────────────────────────────────────────────────────────
// D-Z: osoby dzialajace przy wpisach (notariusz, zastepca notarialny)
// ─────────────────────────────────────────────────────────────

const FUNKCJE_DZIALAJACYCH = ['notariusz', 'zastepca_notarialny'];

router.get(
  '/osoby-dzialajace',
  autoryzacja.wymagajPracownika,
  asy((zad, odp) => {
    const osoby = db().prepare('SELECT * FROM psa_osoby_dzialajace ORDER BY aktywny DESC, nazwisko, imie').all();
    odp.json({
      osoby: osoby.map((o) => ({ ...o, aktywny: Boolean(o.aktywny) })),
      moja_domyslna_id: zad.uzytkownik.osoba_dzialajaca_id ?? null,
    });
  })
);

router.post(
  '/osoby-dzialajace',
  autoryzacja.wymagajAdmina,
  asy((zad, odp) => {
    const { imie, nazwisko, funkcja } = zad.body || {};
    if (!String(imie || '').trim() || !String(nazwisko || '').trim()) {
      throw bledneZadanie('Podaj imię i nazwisko osoby działającej.');
    }
    if (!FUNKCJE_DZIALAJACYCH.includes(funkcja)) {
      throw bledneZadanie('Funkcja musi być „notariusz” albo „zastepca_notarialny”.');
    }
    const wynik = db()
      .prepare('INSERT INTO psa_osoby_dzialajace (imie, nazwisko, funkcja, aktywny, utworzono) VALUES (?, ?, ?, 1, ?)')
      .run(String(imie).trim(), String(nazwisko).trim(), funkcja, czas.terazIso());
    odp.status(201).json({ osoba: db().prepare('SELECT * FROM psa_osoby_dzialajace WHERE id = ?').get(wynik.lastInsertRowid) });
  })
);

router.patch(
  '/osoby-dzialajace/:id',
  autoryzacja.wymagajAdmina,
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    if (!db().prepare('SELECT id FROM psa_osoby_dzialajace WHERE id = ?').get(id)) {
      throw nieZnaleziono('Nie odnaleziono osoby działającej.');
    }
    const { aktywny } = zad.body || {};
    if (aktywny === undefined) throw bledneZadanie('Nie wskazano zmian.');
    // Dane osoby sie nie zmieniaja - wpisy trzymaja ich kopie; zmienic
    // mozna tylko to, czy osoba jest do wyboru przy nowych wpisach.
    db().prepare('UPDATE psa_osoby_dzialajace SET aktywny = ? WHERE id = ?').run(aktywny ? 1 : 0, id);
    odp.json({ osoba: db().prepare('SELECT * FROM psa_osoby_dzialajace WHERE id = ?').get(id) });
  })
);

module.exports.zapewnijAdmina = zapewnijAdmina;
