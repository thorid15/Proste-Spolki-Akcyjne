'use strict';

/**
 * Polaczenie ze WSPOLNA baza kancelarii (SQLite / better-sqlite3).
 *
 * Modul PSA dotyka wylacznie obiektow z prefiksem `psa_` - plik bazy dziela
 * z nim pozostale moduly kancelarii.
 */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const konfiguracja = require('./konfiguracja');

let polaczenie = null;

function otworz(sciezkaPliku = konfiguracja.WSPOLNA_BAZA) {
  const katalog = path.dirname(sciezkaPliku);
  if (sciezkaPliku !== ':memory:' && !fs.existsSync(katalog)) {
    fs.mkdirSync(katalog, { recursive: true });
  }

  const db = new Database(sciezkaPliku);

  // WAL: rownolegly odczyt w trakcie zapisu - baza jest wspoldzielona.
  db.pragma('journal_mode = WAL');
  // NORMAL wystarcza przy WAL; kopie nocne i tak sa poza aplikacja.
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  // Nie blokujemy sie natychmiast, gdy inny modul pisze do wspolnego pliku.
  db.pragma('busy_timeout = 5000');

  return db;
}

/** Singleton polaczenia aplikacji. */
function db() {
  if (!polaczenie) polaczenie = otworz();
  return polaczenie;
}

function zamknij() {
  if (polaczenie) {
    polaczenie.close();
    polaczenie = null;
  }
}

module.exports = { db, otworz, zamknij };
