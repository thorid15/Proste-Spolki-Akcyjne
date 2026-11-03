'use strict';

/**
 * Oświadczenia osoby — zgoda na komunikację e-mail i żądanie powiadomień automatycznych (D-092, R4 K5).
 *
 * To DANE KARTOTEKI osoby, nie informacja w rejestrze: złożenie i cofnięcie działa od razu, bez wpisu,
 * bez zdarzenia w łańcuchu i bez opłaty (D-083). W rejestrze i w informacji z rejestru zostaje tylko
 * adres e-mail — wyłącznie przy aktywnej zgodzie (art. 300(33) § 1 pkt 5 KSH).
 * Jedno źródło stanu: `stanOswiadczen`; historia (data, źródło, kto) — `psa_oswiadczenia` (append-only).
 */

const czas = require('./pomocnicze/czas');

const RODZAJE = ['zgoda_email', 'powiadomienia_automatyczne'];
const ZRODLA = ['portal', 'kancelaria', 'pismo'];

/** @returns {{zgodaEmail: boolean, powiadomieniaAutomatyczne: boolean, email: string|null, zmieniono: string|null}} */
function stanOswiadczen(db, osobaId) {
  const osoba = db.prepare('SELECT email, zgoda_email_status FROM psa_osoby WHERE id = ?').get(osobaId);
  if (!osoba) return null;
  const ostatnie = (rodzaj) => db.prepare(
    'SELECT zlozone, utworzono FROM psa_oswiadczenia WHERE osoba_id = ? AND rodzaj = ? ORDER BY utworzono DESC, id DESC LIMIT 1'
  ).get(osobaId, rodzaj);
  const pow = ostatnie('powiadomienia_automatyczne');
  const zmiana = db.prepare('SELECT MAX(utworzono) AS kiedy FROM psa_oswiadczenia WHERE osoba_id = ?').get(osobaId);
  return {
    zgodaEmail: osoba.zgoda_email_status === 'potwierdzona' && Boolean(osoba.email),
    powiadomieniaAutomatyczne: Boolean(pow && pow.zlozone),
    email: osoba.email || null,
    zmieniono: zmiana ? zmiana.kiedy : null,
  };
}

function historiaOswiadczen(db, osobaId) {
  return db.prepare(
    `SELECT id, rodzaj, zlozone, email, zrodlo, autor, spolka_id, utworzono
       FROM psa_oswiadczenia WHERE osoba_id = ? ORDER BY utworzono DESC, id DESC`
  ).all(osobaId);
}

/**
 * Zapis oświadczenia — od razu zmienia kartotekę (zgoda e-mail) i dopisuje historię.
 * Ten sam stan co obecny → bez nowego wpisu w historii (jedno aktywne oświadczenie na rodzaj).
 */
function zapiszOswiadczenie(db, { osobaId, rodzaj, zlozone, email = null, zrodlo = 'portal', autor = null, kontoId = null, spolkaId = null }) {
  if (!RODZAJE.includes(rodzaj)) throw new Error('Nieznany rodzaj oświadczenia.');
  if (!ZRODLA.includes(zrodlo)) throw new Error('Nieznane źródło oświadczenia.');
  const teraz = czas.terazIso();
  return db.transaction(() => {
    const przed = stanOswiadczen(db, osobaId);
    const aktywne = rodzaj === 'zgoda_email' ? przed.zgodaEmail : przed.powiadomieniaAutomatyczne;
    const nowyEmail = rodzaj === 'zgoda_email' && zlozone ? String(email || przed.email || '').trim().toLowerCase() || null : null;
    if (aktywne === Boolean(zlozone) && (!nowyEmail || nowyEmail === przed.email)) return przed;
    if (rodzaj === 'zgoda_email') {
      db.prepare('UPDATE psa_osoby SET zgoda_email_status = ?, zgoda_email = ?, email = COALESCE(?, email), zaktualizowano = ? WHERE id = ?')
        .run(zlozone ? 'potwierdzona' : 'brak', zlozone ? 1 : 0, nowyEmail, teraz, osobaId);
    }
    db.prepare(
      `INSERT INTO psa_oswiadczenia (osoba_id, spolka_id, rodzaj, zlozone, email, konto_id, zrodlo, autor, utworzono)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(osobaId, spolkaId, rodzaj, zlozone ? 1 : 0, nowyEmail, kontoId, zrodlo, autor, teraz);
    return stanOswiadczen(db, osobaId);
  })();
}

module.exports = { RODZAJE, ZRODLA, stanOswiadczen, historiaOswiadczen, zapiszOswiadczenie };
