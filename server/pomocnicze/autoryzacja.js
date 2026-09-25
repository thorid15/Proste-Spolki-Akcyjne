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

/** Zapisuje bieżący token danego ciastka na czarnej liście (Z-250) — jeśli jest ważny. */
function uniewaznijBiezacyToken(zad, nazwaCiastka) {
  const token = ciasteczka.parsuj(zad.headers.cookie)[nazwaCiastka];
  if (!token) return;
  const payload = sesja.odczytaj(token);
  if (!payload || !payload.jti) return;
  db()
    .prepare('INSERT OR IGNORE INTO psa_sesje_uniewaznione (jti, wygasa) VALUES (?, ?)')
    .run(payload.jti, new Date(payload.exp).toISOString());
}

function zalogujPracownika(zad, odp, uzytkownikId) {
  const wiersz = db().prepare('SELECT tokeny_wersja FROM psa_uzytkownicy WHERE id = ?').get(uzytkownikId);
  const token = sesja.wystaw(
    { typ: 'pracownik', id: uzytkownikId, wersja: wiersz ? wiersz.tokeny_wersja : 0 },
    sesja.TTL_PRACOWNIK_MS
  );
  ustawCiastkoSesji(zad, odp, CIASTKO_PRACOWNIK, token, sesja.TTL_PRACOWNIK_MS);
}

/** Wylogowanie unieważnia WYŁĄCZNIE token z bieżącego ciastka (Z-250) — inne urządzenia zostają zalogowane. */
function wylogujPracownika(zad, odp) {
  uniewaznijBiezacyToken(zad, CIASTKO_PRACOWNIK);
  usunCiastkoSesji(zad, odp, CIASTKO_PRACOWNIK);
}

function zalogujKonto(zad, odp, kontoId) {
  const wiersz = db().prepare('SELECT tokeny_wersja FROM psa_konta WHERE id = ?').get(kontoId);
  const token = sesja.wystaw(
    { typ: 'konto', id: kontoId, wersja: wiersz ? wiersz.tokeny_wersja : 0 },
    sesja.TTL_PORTAL_MS
  );
  ustawCiastkoSesji(zad, odp, CIASTKO_PORTAL, token, sesja.TTL_PORTAL_MS);
}

function wylogujKonto(zad, odp) {
  uniewaznijBiezacyToken(zad, CIASTKO_PORTAL);
  usunCiastkoSesji(zad, odp, CIASTKO_PORTAL);
}

/** Podbija licznik wersji tokenów — uniewaznia NATYCHMIAST wszystkie dotychczasowe tokeny konta (Z-251). */
function uniewaznijWszystkieTokeny(typ, id) {
  const tabela = typ === 'pracownik' ? 'psa_uzytkownicy' : 'psa_konta';
  db().prepare(`UPDATE ${tabela} SET tokeny_wersja = tokeny_wersja + 1 WHERE id = ?`).run(id);
}

/** Usuwa przeterminowane wpisy z czarnej listy tokenów — wywoływane raz przy starcie serwera. */
function wyczyscWygasleUniewaznienia() {
  db().prepare('DELETE FROM psa_sesje_uniewaznione WHERE wygasa < ?').run(new Date().toISOString());
}

/** Token unieważniony jawnie (wylogowanie) — sprawdzenie po `jti`, jeśli token go niesie. */
function tokenUniewazniony(jti) {
  if (!jti) return false;
  return Boolean(db().prepare('SELECT 1 FROM psa_sesje_uniewaznione WHERE jti = ?').get(jti));
}

/** Wypełnia `zad.uzytkownik` i `zad.konto`, jeśli ciasteczka niosą ważną sesję. Nigdy nie blokuje. */
function wczytajSesje(zad, odp, dalej) {
  const ciastka = ciasteczka.parsuj(zad.headers.cookie);

  const tokenPracownika = ciastka[CIASTKO_PRACOWNIK];
  if (tokenPracownika) {
    const payload = sesja.odczytaj(tokenPracownika);
    if (payload && payload.typ === 'pracownik' && !tokenUniewazniony(payload.jti)) {
      const wiersz = db().prepare('SELECT * FROM psa_uzytkownicy WHERE id = ?').get(payload.id);
      // `tokeny_wersja` inna niz w tokenie = haslo zmienione PO wystawieniu
      // tego tokenu (Z-251) — token przestaje byc wazny natychmiast, nie
      // dopiero po TTL.
      if (wiersz && wiersz.aktywny && wiersz.tokeny_wersja === payload.wersja) zad.uzytkownik = wiersz;
    }
  }

  const tokenKonta = ciastka[CIASTKO_PORTAL];
  if (tokenKonta) {
    const payload = sesja.odczytaj(tokenKonta);
    if (payload && payload.typ === 'konto' && !tokenUniewazniony(payload.jti)) {
      const wiersz = db().prepare('SELECT * FROM psa_konta WHERE id = ?').get(payload.id);
      if (wiersz && wiersz.aktywne && wiersz.tokeny_wersja === payload.wersja) {
        zad.konto = wiersz;
        // FAZA4 pkt6 — ostrzeżenie 5 minut przed wygaśnięciem sesji portalu
        // (8h): front porównuje ten znacznik z zegarem klienta, patrz
        // `usePortalSesja`/`GET /whoami`.
        zad.sesjaWygasa = payload.exp;
      }
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
  uniewaznijWszystkieTokeny,
  wyczyscWygasleUniewaznienia,
};
