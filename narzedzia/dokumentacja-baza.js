#!/usr/bin/env node
'use strict';

/**
 * Generuje `testy-audyt/schemat-bazy.txt` z REALNEGO schematu bazy (migracje
 * uruchomione na bazie w pamięci), nie z lektury `migracje.js`.
 *
 * Część `npm run dokumentacja` (README, sekcja "Dokumentacja") — uruchamiana
 * na końcu każdej sesji dotykającej schemat.
 */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const migracje = require('../server/migracje');

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
migracje.uruchom(db);

const tabele = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'psa_%' ORDER BY name")
  .all()
  .map((w) => w.name);

const linie = [];
for (const tabela of tabele) {
  const kolumny = db.prepare(`PRAGMA table_info(${tabela})`).all();
  linie.push(`### ${tabela}`);
  for (const k of kolumny) {
    linie.push(
      `  - ${k.name} ${k.type}` +
        (k.notnull ? ' NOT NULL' : '') +
        (k.dflt_value !== null ? ` DEFAULT ${k.dflt_value}` : '') +
        (k.pk ? ' PK' : '')
    );
  }
}
db.close();

const cel = path.join(__dirname, '..', 'testy-audyt', 'schemat-bazy.txt');
fs.writeFileSync(cel, linie.join('\n') + '\n');
console.log(`[dokumentacja] zapisano ${cel} (${tabele.length} tabel)`);
