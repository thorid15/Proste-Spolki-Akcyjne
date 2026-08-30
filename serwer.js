'use strict';

/**
 * Rejestr akcjonariuszy P.S.A. — punkt wejscia modulu.
 *
 * Port dev: 3005. Prefiks tabel: `psa_*`. Trasy: `/api/psa/...`.
 */

const path = require('node:path');
const express = require('express');

const konfiguracja = require('./server/konfiguracja');
const { db } = require('./server/baza');
const migracje = require('./server/migracje');
const { posrednikBledow } = require('./server/pomocnicze/odpowiedzi');
const autoryzacja = require('./server/pomocnicze/autoryzacja');
const auth = require('./server/trasy/auth');

const aplikacja = express();

aplikacja.disable('x-powered-by');
// Wariant wdrozenia A (sekcja 2): aplikacja stoi za reverse proxy (TLS) -
// `trust proxy` daje poprawny `zad.secure`/`zad.ip` z naglowkow proxy,
// potrzebne do flagi `Secure` na ciasteczkach sesji i do rate limitera.
aplikacja.set('trust proxy', 1);
aplikacja.use(express.json({ limit: '1mb' }));
aplikacja.use(autoryzacja.wczytajSesje);

// ── Migracje przy starcie - idempotentne ─────────────────────────────────
const zastosowane = migracje.uruchom(db());
if (zastosowane.length > 0) {
  console.log(`[psa] wykonano migracje: ${zastosowane.join(', ')}`);
}

// ── API ──────────────────────────────────────────────────────────────────
// `/api/wspolne` i `/api/psa/auth` (logowanie) musza byc dostepne bez sesji.
// `/api/psa/portal` ma wlasna sesje (konto), niezalezna od sesji pracownika.
// Reszta wymaga zalogowanego pracownika kancelarii (odstepstwo nr 2, sekcja 2).
aplikacja.use('/api/wspolne', require('./server/trasy/wspolne'));
aplikacja.use('/api/psa/auth', auth);
if (konfiguracja.PORTAL_WLACZONY) {
  aplikacja.use('/api/psa/portal', require('./server/trasy/portal'));
} else {
  aplikacja.use('/api/psa/portal', (zad, odp) => {
    odp.status(503).json({ blad: 'Portal klienta jest obecnie wyłączony.' });
  });
}
aplikacja.use('/api/psa/spolki', autoryzacja.wymagajPracownika, require('./server/trasy/spolki'));
aplikacja.use('/api/psa/osoby', autoryzacja.wymagajPracownika, require('./server/trasy/osoby'));
aplikacja.use('/api/psa/sprawy', autoryzacja.wymagajPracownika, require('./server/trasy/sprawy'));
aplikacja.use('/api/psa/zdarzenia', autoryzacja.wymagajPracownika, require('./server/trasy/zdarzenia'));
aplikacja.use('/api/psa/oplaty', autoryzacja.wymagajPracownika, require('./server/trasy/oplaty'));
aplikacja.use('/api/psa/szablony', autoryzacja.wymagajPracownika, require('./server/trasy/szablony'));
aplikacja.use('/api/psa/zgloszenia', autoryzacja.wymagajPracownika, require('./server/trasy/zgloszenia'));
aplikacja.use('/api/psa/wnioski', autoryzacja.wymagajPracownika, require('./server/trasy/wnioski'));
aplikacja.use('/api/psa', require('./server/trasy/pozostale'));

// ── Statyki ──────────────────────────────────────────────────────────────
// Moduł ma wlasna tozsamosc wizualna w /style/rejestr.css (sesja 6, faza 1) -
// `design.css` zostal z niego wygaszony i nie jest juz serwowany.
// Portal klienta to OSOBNA aplikacja jednostronicowa (wlasny routing na
// hashu, wlasna sesja) - jawny routing na wypadek koncowego "/", ktorego
// `express.static` z opcja `extensions` nie rozwiazuje do pliku.
aplikacja.get(['/portal', '/portal/'], (zad, odp) => {
  odp.sendFile(path.join(__dirname, 'publiczne', 'portal.html'));
});
aplikacja.use(express.static(path.join(__dirname, 'publiczne'), { extensions: ['html'] }));

// Nieznana trasa API konczy sie JSON-em, nie strona.
aplikacja.use('/api', (zad, odp) => {
  odp.status(404).json({ blad: `Nieznany endpoint: ${zad.method} /api${zad.path}` });
});

// Brakujacy plik statyczny ma byc 404, a nie strona aplikacji. Bez tego
// `<img src="/obrazy/notariat.svg">` dostawal w odpowiedzi index.html
// z kodem 200 - przegladarka i tak nie zrobila z tego obrazka, ale
// "200 OK" na nieistniejacy plik myli przy kazdej diagnozie.
aplikacja.use(['/obrazy', '/style', '/js', '/vendor'], (zad, odp) => {
  odp.status(404).type('text/plain').send('Nie odnaleziono pliku.');
});

// Pozostale sciezki obsluguje aplikacja jednostronicowa.
aplikacja.get('*', (zad, odp) => {
  odp.sendFile(path.join(__dirname, 'publiczne', 'index.html'));
});

aplikacja.use(posrednikBledow);

// ─────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  auth.zapewnijAdmina(db(), konfiguracja.ADMIN_EMAIL).finally(() => {
    aplikacja.listen(konfiguracja.PORT, () => {
      console.log(`[psa] Rejestr akcjonariuszy P.S.A. — http://localhost:${konfiguracja.PORT}`);
      console.log(`[psa] baza: ${konfiguracja.WSPOLNA_BAZA}`);
      console.log(`[psa] portal klienta: ${konfiguracja.PORTAL_WLACZONY ? 'włączony' : 'wyłączony (PORTAL_WLACZONY=false)'}`);
    });
  });
}

module.exports = aplikacja;
