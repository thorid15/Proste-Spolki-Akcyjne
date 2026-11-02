'use strict';

/**
 * Kolejka listów (W4.3, SESJA-PSA-WYTYCZNE.md Faza 3).
 *
 * Pismo do osoby, która NIE wyraziła zgody na komunikację e-mail
 * (art. 300(33) § 1 pkt 5 KSH — zgoda jest daną rejestru), idzie pocztą na
 * adres Z REJESTRU. Adres kopiujemy w chwili wystawienia pisma — nigdy nie
 * bierzemy go od żądającego wpisu (W4.4). Kancelaria drukuje pismo, wpisuje
 * datę i numer nadania, dołącza skan potwierdzenia nadania; dopiero wtedy
 * pismo uznaje się za wysłane (status doręczenia), a przy powiadomieniu
 * uprzednim — sprawa przestaje być zablokowana (W2.3).
 */

const czas = require('./pomocnicze/czas');

const ZGODA_POTWIERDZONA = 'potwierdzona';

/** E-mail tylko przy zgodzie potwierdzonej (złożonej osobiście, W4.1) i adresie. */
function kanalDlaOsoby(osoba) {
  return osoba && osoba.email && osoba.zgoda_email_status === ZGODA_POTWIERDZONA ? 'email' : 'papier';
}

function oznaczenie(osoba) {
  if (!osoba) return '—';
  return osoba.typ === 'prawna' ? osoba.nazwa : [osoba.imie, osoba.nazwisko].filter(Boolean).join(' ');
}

/** Adres do doręczeń z rejestru (art. 300(33) § 1 pkt 5): inny adres do doręczeń albo adres główny. */
function adresZRejestru(osoba) {
  if (!osoba) return '';
  if (osoba.adres_doreczen && String(osoba.adres_doreczen).trim()) return String(osoba.adres_doreczen).trim();
  const ulica = [osoba.ulica, [osoba.nr_domu, osoba.nr_lokalu].filter(Boolean).join('/')].filter(Boolean).join(' ');
  const miasto = [osoba.kod_pocztowy, osoba.miejscowosc].filter(Boolean).join(' ');
  const kraj = osoba.kraj && osoba.kraj !== 'Polska' ? osoba.kraj : null;
  return [ulica, miasto, kraj].filter(Boolean).join(', ');
}

/** QW2 — czy osoba żąda automatycznych powiadomień (ostatnie oświadczenie osoby). */
function zadaPowiadomienAutomatycznych(db, osobaId, spolkaId) { // eslint-disable-line no-unused-vars
  // D-092 / P7: jedno aktywne oświadczenie na rodzaj — stan osoby z kartoteki (`stanOswiadczen`).
  const stan = require('./oswiadczenia').stanOswiadczen(db, osobaId);
  return Boolean(stan && stan.powiadomieniaAutomatyczne);
}

function dodaj(db, { wydanyDokumentId, spolkaId, sprawaId, osoba, rodzajPisma }) {
  const adres = adresZRejestru(osoba);
  const wynik = db.prepare(
    `INSERT INTO psa_listy (wydany_dokument_id, spolka_id, sprawa_id, odbiorca_osoba_id, odbiorca_nazwa, adres,
                            rodzaj_pisma, status, utworzono)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'do_wyslania', ?)`
  ).run(wydanyDokumentId, spolkaId, sprawaId || null, osoba ? osoba.id : null, oznaczenie(osoba),
    adres || '— brak adresu w rejestrze —', rodzajPisma, czas.terazIso());
  return Number(wynik.lastInsertRowid);
}

function lista(db, { status = null } = {}) {
  return db.prepare(
    `SELECT l.*, s.nazwa AS spolka_nazwa, sp.numer AS sprawa_numer
       FROM psa_listy l JOIN psa_spolki s ON s.id = l.spolka_id
       LEFT JOIN psa_sprawy sp ON sp.id = l.sprawa_id
      WHERE (? IS NULL OR l.status = ?)
      ORDER BY (l.status = 'do_wyslania') DESC, l.utworzono ASC`
  ).all(status, status);
}

function wczytaj(db, id) {
  return db.prepare('SELECT * FROM psa_listy WHERE id = ?').get(id) || null;
}

/**
 * Nadanie: data i numer nadania (wymagane), skan potwierdzenia (opcjonalnie
 * od razu, można dołączyć później). Ustawia `wyslano` pisma, a przy
 * powiadomieniu uprzednim — `powiadomienie_wyslano` sprawy.
 */
function oznaczNadanie(db, id, { dataNadania, numerNadania, potwierdzenie, autor }) {
  const list = wczytaj(db, id);
  if (!list) return null;
  if (list.status === 'usuniety') throw new BladListu('List został usunięty z wysyłki — nie można go nadać.', 409);
  db.transaction(() => {
    db.prepare(
      `UPDATE psa_listy SET status = 'nadany', data_nadania = ?, numer_nadania = ?, nadal = ?,
              potwierdzenie_sciezka = COALESCE(?, potwierdzenie_sciezka),
              potwierdzenie_nazwa = COALESCE(?, potwierdzenie_nazwa)
        WHERE id = ?`
    ).run(dataNadania, numerNadania, autor, potwierdzenie ? potwierdzenie.sciezka : null,
      potwierdzenie ? potwierdzenie.nazwa : null, id);
    db.prepare('UPDATE psa_wydane_dokumenty SET wyslano = ? WHERE id = ? AND wyslano IS NULL')
      .run(dataNadania, list.wydany_dokument_id);
    if (list.rodzaj_pisma === 'powiadomienie' && list.sprawa_id) {
      db.prepare('UPDATE psa_sprawy SET powiadomienie_wyslano = COALESCE(powiadomienie_wyslano, ?), zaktualizowano = ? WHERE id = ?')
        .run(dataNadania, czas.terazIso(), list.sprawa_id);
    }
  })();
  return wczytaj(db, id);
}

class BladListu extends Error {
  constructor(komunikat, kod = 400) {
    super(komunikat);
    this.kod = kod;
  }
}

/**
 * R4 K3: „Usuń z wysyłki” — tylko przed nadaniem. Pismo zostaje (bez fizycznego kasowania), powód, kto
 * i kiedy w rekordzie listu oraz w notatce sprawy. Usunięte powiadomienie przed wpisem → sprawa „bez
 * powiadomienia” (wpis zablokowany, art. 300(34) § 3 KSH), o ile nie nadano innego powiadomienia.
 */
function usunZWysylki(db, id, { powod, autor }) {
  const list = wczytaj(db, id);
  if (!list) return null;
  const tekst = String(powod || '').trim();
  if (list.status === 'nadany') throw new BladListu('List został nadany — nie można go usunąć z wysyłki.', 409);
  if (list.status === 'usuniety') throw new BladListu('List został już usunięty z wysyłki.', 409);
  if (tekst.length < 5) throw new BladListu('Podaj powód usunięcia z wysyłki (co najmniej 5 znaków).');
  const teraz = czas.terazIso();
  db.transaction(() => {
    db.prepare(`UPDATE psa_listy SET status = 'usuniety', usuniecie_powod = ?, usunal = ?, usunieto = ? WHERE id = ?`)
      .run(tekst, autor || null, teraz, id);
    if (list.sprawa_id) {
      if (list.rodzaj_pisma === 'powiadomienie') {
        const inneNadane = db.prepare(
          `SELECT 1 FROM psa_listy WHERE sprawa_id = ? AND rodzaj_pisma = 'powiadomienie' AND status = 'nadany' AND id <> ?`
        ).get(list.sprawa_id, id);
        if (!inneNadane) db.prepare('UPDATE psa_sprawy SET powiadomienie_wyslano = NULL WHERE id = ?').run(list.sprawa_id);
      }
      db.prepare(
        `UPDATE psa_sprawy SET notatka = COALESCE(notatka || char(10), '') || ?, zaktualizowano = ? WHERE id = ?`
      ).run(`[${teraz.slice(0, 10)}] List (${list.rodzaj_pisma}) do ${list.odbiorca_nazwa} usunięty z wysyłki: ${tekst} (${autor || '—'})`, teraz, list.sprawa_id);
    }
  })();
  return wczytaj(db, id);
}

module.exports = {
  kanalDlaOsoby, adresZRejestru, oznaczenie, dodaj, lista, wczytaj, oznaczNadanie, zadaPowiadomienAutomatycznych,
  usunZWysylki, BladListu,
};
