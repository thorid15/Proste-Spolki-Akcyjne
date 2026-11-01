'use strict';

/**
 * Informacje z rejestru (W5.3, W5.5, W5.6): numer, wynagrodzenie z VAT
 * i podstawą prawną, dziennik wydanych informacji.
 */

const czas = require('./pomocnicze/czas');
const przepisy = require('./logika/przepisy');
const ustawienia = require('./logika/ustawienia');

/** Kolejny numer informacji w roku: INF/RRRR/NNNN. */
function nadajNumer(db) {
  const rok = czas.dzisIso().slice(0, 4);
  const w = db.prepare(
    `SELECT COUNT(*) AS n FROM psa_wydane_dokumenty
      WHERE typ = 'informacja_z_rejestru' AND numer LIKE ?`
  ).get(`INF/${rok}/%`);
  return `INF/${rok}/${String(w.n + 1).padStart(4, '0')}`;
}

/** Wynagrodzenie na informacji (W5.5) — stawka bieżąca (D-085). */
function wynagrodzenie(db, { spolka, nettoGrosze = null, vatProcent = null, pobrano = true, uwaga = null }) {
  const netto = nettoGrosze != null ? Number(nettoGrosze) : ustawienia.stawkaGrosze(db, 'informacja', { spolka });
  const procent = vatProcent != null ? Number(vatProcent) : przepisy.STAWKA_VAT_PROCENT;
  const brutto = przepisy.obliczBrutto(netto, procent);
  return {
    netto, vat_procent: procent, vat: brutto - netto, brutto, pobrano, uwaga,
    podstawa: przepisy.PODSTAWY.WYNAGRODZENIE_INFORMACJI,
  };
}

/** Dziennik wydanych informacji (W5.6): numer, data, odbiorca, opłata. */
function dziennik(db) {
  return db.prepare(
    `SELECT w.id, w.numer, w.utworzono, w.kanal, w.sygnatura, w.spolka_id, s.nazwa AS spolka_nazwa,
            COALESCE(w.odbiorca_opis,
              CASE WHEN o.id IS NULL THEN 'spółka'
                   WHEN o.typ = 'prawna' THEN o.nazwa ELSE TRIM(COALESCE(o.imie, '') || ' ' || COALESCE(o.nazwisko, '')) END) AS odbiorca,
            op.kwota_grosze AS oplata_netto_grosze, op.stawka_vat_procent, op.status AS oplata_status
       FROM psa_wydane_dokumenty w
       JOIN psa_spolki s ON s.id = w.spolka_id
       LEFT JOIN psa_osoby o ON o.id = w.odbiorca_osoba_id
       LEFT JOIN psa_oplaty op ON op.wydany_dokument_id = w.id
      WHERE w.typ = 'informacja_z_rejestru'
      ORDER BY w.id DESC`
  ).all().map((r) => ({
    ...r,
    oplata_brutto_grosze: r.oplata_netto_grosze != null
      ? przepisy.obliczBrutto(r.oplata_netto_grosze, r.stawka_vat_procent ?? przepisy.STAWKA_VAT_PROCENT) : null,
    oplata_opis: r.oplata_netto_grosze != null ? null : 'nie pobrano',
  }));
}

module.exports = { nadajNumer, wynagrodzenie, dziennik };
