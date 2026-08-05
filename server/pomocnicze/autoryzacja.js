'use strict';

/**
 * Uwierzytelnianie sesyjne (odstępstwo nr 2 z sekcji 2 specyfikacji:
 * publiczny dostęp wyklucza identyfikację samym nagłówkiem `X-User-Name`).
 *
 * Dwa niezależne podmioty, dwa ciasteczka - pracownik kancelarii może być
 * jednocześnie zalogowany do portalu w tej samej przeglądarce (np. testując
 * konto klienckie), sesje się nie mieszają:
 *   - `psa_sesja`        — pracownik kancelarii (`psa_uzytkownicy`)
 *   - `psa_sesja_portal` — konto klienta (`psa_konta`)
 *
 * Token niesie wyłącznie id + typ (patrz `logika/sesja.js`) - stan konta
 * (aktywność, rola) czytamy z bazy przy KAŻDYM żądaniu, więc dezaktywacja
 * konta działa natychmiast, bez czekania na wygaśnięcie tokenu.
 */

const { db } = require('../baza');
const sesja = require('../logika/sesja');
const ciasteczka = require('./ciasteczka');
const { BladZadania, nieAutoryzowany } = require('./odpowiedzi');

const CIASTKO_PRACOWNIK = 'psa_sesja';
const CIASTKO_PORTAL = 'psa_sesja_portal';

/** Czy żądanie przyszło przez HTTPS - bezpośrednio albo za reverse proxy. */
function polaczenieHttps(zad) {
  return Boolean(zad.secure) || process.env.NODE_ENV === 'production';
}

function ustawCiastkoSesji(zad, odp, nazwa, token, ttlMs) {
  ciasteczka.ustaw(odp, nazwa, token, { maxAgeMs: ttlMs, wymuszajHttps: polaczenieHttps(zad) });
}

function usunCiastkoSesji(zad, odp, nazwa) {
  ciasteczka.usun(odp, nazwa, { wymuszajHttps: polaczenieHttps(zad) });
}

function zalogujPracownika(zad, odp, uzytkownikId) {
  const token = sesja.wystaw({ typ: 'pracownik', id: uzytkownikId }, sesja.TTL_PRACOWNIK_MS);
  ustawCiastkoSesji(zad, odp, CIASTKO_PRACOWNIK, token, sesja.TTL_PRACOWNIK_MS);
}

function wylogujPracownika(zad, odp) {
  usunCiastkoSesji(zad, odp, CIASTKO_PRACOWNIK);
}

function zalogujKonto(zad, odp, kontoId) {
  const token = sesja.wystaw({ typ: 'konto', id: kontoId }, sesja.TTL_PORTAL_MS);
  ustawCiastkoSesji(zad, odp, CIASTKO_PORTAL, token, sesja.TTL_PORTAL_MS);
}

function wylogujKonto(zad, odp) {
  usunCiastkoSesji(zad, odp, CIASTKO_PORTAL);
}

/** Wypełnia `zad.uzytkownik` i `zad.konto`, jeśli ciasteczka niosą ważną sesję. Nigdy nie blokuje. */
function wczytajSesje(zad, odp, dalej) {
  const ciastka = ciasteczka.parsuj(zad.headers.cookie);

  const tokenPracownika = ciastka[CIASTKO_PRACOWNIK];
  if (tokenPracownika) {
    const payload = sesja.odczytaj(tokenPracownika);
    if (payload && payload.typ === 'pracownik') {
      const wiersz = db().prepare('SELECT * FROM psa_uzytkownicy WHERE id = ?').get(payload.id);
      if (wiersz && wiersz.aktywny) zad.uzytkownik = wiersz;
    }
  }

  const tokenKonta = ciastka[CIASTKO_PORTAL];
  if (tokenKonta) {
    const payload = sesja.odczytaj(tokenKonta);
    if (payload && payload.typ === 'konto') {
      const wiersz = db().prepare('SELECT * FROM psa_konta WHERE id = ?').get(payload.id);
      if (wiersz && wiersz.aktywne) zad.konto = wiersz;
    }
  }

  dalej();
}

/** Wymaga zalogowanego, aktywnego pracownika kancelarii. */
function wymagajPracownika(zad, odp, dalej) {
  if (!zad.uzytkownik) return dalej(nieAutoryzowany('Ta operacja wymaga zalogowania.'));
  dalej();
}

/** Wymaga roli `admin`. */
function wymagajAdmina(zad, odp, dalej) {
  if (!zad.uzytkownik) return dalej(nieAutoryzowany('Ta operacja wymaga zalogowania.'));
  if (zad.uzytkownik.rola !== 'admin') {
    const blad = new BladZadania(403, 'Ta operacja jest dostępna wyłącznie dla administratora.');
    return dalej(blad);
  }
  dalej();
}

/** Wymaga zalogowanego, aktywnego konta portalowego. */
function wymagajKonta(zad, odp, dalej) {
  if (!zad.konto) return dalej(nieAutoryzowany('Ta operacja wymaga zalogowania do portalu.'));
  dalej();
}

module.exports = {
  CIASTKO_PRACOWNIK,
  CIASTKO_PORTAL,
  wczytajSesje,
  wymagajPracownika,
  wymagajAdmina,
  wymagajKonta,
  zalogujPracownika,
  wylogujPracownika,
  zalogujKonto,
  wylogujKonto,
};
