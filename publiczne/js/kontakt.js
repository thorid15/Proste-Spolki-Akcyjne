'use strict';

/**
 * Znacznik kontaktu (R4 K5, D-092) — czysta logika (test: `testy/oswiadczenia-k5.test.js`).
 * Liczy się stan bieżący: zgoda potwierdzona ORAZ adres e-mail. Inaczej korespondencja idzie listem.
 */

const TEKST_ZNACZNIKA = 'Brak zgody — konieczne powiadomienie listem';
const PODPOWIEDZ_ZNACZNIKA = 'Osoba nie wyraziła zgody na komunikację e-mail. Powiadomienie o zamiarze wpisu i zawiadomienie o dokonanym wpisie zostaną wysłane listem.';

function wymagaListu(osoba) {
  if (!osoba) return false;
  return !(osoba.zgoda_email_status === 'potwierdzona' && String(osoba.email || '').trim());
}

if (typeof module !== 'undefined' && module.exports) module.exports = { wymagaListu, TEKST_ZNACZNIKA, PODPOWIEDZ_ZNACZNIKA };
