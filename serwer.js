'use strict';

/**
 * Rejestr akcjonariuszy P.S.A. — punkt wejscia modulu.
 *
 * Port dev: 3005. Prefiks tabel: `psa_*`. Trasy: `/api/psa/...`.
 */

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const konfiguracja = require('./server/konfiguracja');
const { db } = require('./server/baza');
const migracje = require('./server/migracje');
const { posrednikBledow } = require('./server/pomocnicze/odpowiedzi');
const autoryzacja = require('./server/pomocnicze/autoryzacja');
const adresy = require('./server/logika/adresy');
const { uruchomProcesDzienny } = require('./server/logika/harmonogram');
// Tryb testowy: moduły `server/tryb-testowy/` wczytują się wyłącznie przy PSA_TRYB_TESTOWY=1 (§ 7 pkt 9).
const trybTestowy = konfiguracja.TRYB_TESTOWY ? require('./server/tryb-testowy') : null;

const aplikacja = express();

aplikacja.disable('x-powered-by');
// Wariant wdrozenia A (sekcja 2): aplikacja stoi za reverse proxy (TLS) -
// `trust proxy` daje poprawny `zad.secure`/`zad.ip` z naglowkow proxy,
// potrzebne do flagi `Secure` na ciasteczkach sesji i do rate limitera.
aplikacja.set('trust proxy', 1);
aplikacja.use(express.json({ limit: '1mb' }));

/**
 * Naglowki bezpieczenstwa — wlasny middleware, bez zaleznosci (sekcja 11).
 *
 * Bez nich przegladarka nie ma zadnej instrukcji, jak traktowac odpowiedzi
 * tej aplikacji: wolno ja osadzic w cudzej ramce (clickjacking na formularzu
 * podpisywania dokumentow), wolno zgadywac typ pliku wbrew Content-Type
 * (wgrany „skan" udajacy HTML wykonalby sie w kontekscie rejestru), a adres
 * strony z numerem sprawy wycieka w Refererze na kazdy klikniety odnosnik.
 *
 * Od FAZY 1 sesji frontendowej (D-046) JSX kompiluje sie przy budowaniu
 * (`narzedzia/buduj-front.js`), wiec CSP nie ma juz `unsafe-eval` ani
 * `unsafe-inline` dla skryptow — przegladarka wykonuje wylacznie pliki
 * z tego serwera.
 */
// Style: React ustawia je przez CSSOM (CSP tego nie blokuje), więc poza trybem testowym bez 'unsafe-inline';
// strony i pasek trybu testowego mają style w znacznikach.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  konfiguracja.TRYB_TESTOWY ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
  "img-src 'self' data:",
  // Kroje pisma leza w `publiczne/fonty` — zaden cudzy serwer nie jest
  // potrzebny i zaden adres IP klienta nigdzie nie wycieka.
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

aplikacja.use((zad, odp, dalej) => {
  odp.setHeader('X-Content-Type-Options', 'nosniff');
  odp.setHeader('X-Frame-Options', 'DENY');
  odp.setHeader('Referrer-Policy', 'same-origin');
  odp.setHeader('Content-Security-Policy', CSP);
  odp.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  // HSTS tylko po HTTPS — wlaczony na czystym HTTP zablokowalby prace
  // lokalna, a i tak nic nie chroni (przegladarka go wtedy ignoruje).
  if (zad.secure) {
    odp.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  dalej();
});

/**
 * § 7 pkt 6: żądanie zmieniające stan z nagłówkiem `Origin` innej strony — 403 (CSRF). Wyjątek: ITN tpay
 * (serwer operatora). Bez nagłówka (klient spoza przeglądarki) — dalej: taki klient nie ma ciasteczek
 * ofiary, a przeglądarki wysyłają `Origin` przy każdym POST z innej strony. Własny adres: nagłówek Host
 * albo host z URL_PORTALU (za reverse proxy).
 */
const HOST_PORTALU = new URL(konfiguracja.URL_PORTALU).host;
function sprawdzOrigin(zad, odp, dalej) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(zad.method) || zad.path === '/api/psa/platnosci/tpay/itn') return dalej();
  const origin = zad.get('origin');
  if (!origin) return dalej();
  let host = null;
  try { host = new URL(origin).host; } catch { host = null; }
  if (host && (host === zad.get('host') || host === HOST_PORTALU)) return dalej();
  return odp.status(403).json({ blad: 'Żądanie z innej strony zostało odrzucone.' });
}
aplikacja.use(sprawdzOrigin);

aplikacja.use(autoryzacja.wczytajSesje);

// ── Tryb testowy (D-074) — straznik PRZED pierwszym dotknieciem bazy ──────
// Przy NODE_ENV=production albo na bazie bez oznaczenia testowego proces
// odmawia startu (T6). Poza trybem testowym nic sie tu nie dzieje.
if (trybTestowy) {
  try {
    trybTestowy.sprawdzStart();
  } catch (e) {
    if (e instanceof trybTestowy.BladTrybuTestowego && require.main === module) {
      console.error(`[psa] ODMOWA STARTU — ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

// ── Migracje przy starcie - idempotentne ─────────────────────────────────
const zastosowane = migracje.uruchom(db());
if (zastosowane.length > 0) {
  console.log(`[psa] wykonano migracje: ${zastosowane.join(', ')}`);
}
// Sprzatanie czarnej listy tokenow (Z-250/Z-251) — wpisy przeterminowane
// razem z tokenem, ktorego dotyczyly, sa juz nieszkodliwym balastem.
autoryzacja.wyczyscWygasleUniewaznienia();

if (trybTestowy) trybTestowy.wczytajStan(db());

// Trasy trybu testowego istnieja WYLACZNIE w trybie testowym — inaczej 404
// (jawnie: bez tego `/test/...` trafialoby w strone aplikacji z kodem 200).
if (trybTestowy) {
  aplikacja.use('/test', require('./server/tryb-testowy/trasy'));
} else {
  aplikacja.use('/test', (zad, odp) => odp.status(404).type('text/plain').send('Nie odnaleziono.'));
}

/** Portal można wyłączyć flagą PORTAL_WLACZONY — wtedy cała ścieżka odpowiada 503. */
function bramkaPortalu(zad, odp, dalej) {
  if (konfiguracja.PORTAL_WLACZONY) return dalej();
  return odp.status(503).json({ blad: 'Portal klienta jest wyłączony.' });
}

/**
 * Audyt W2: trasy pracowników (wszystko poza portalem, danymi do stopki i powiadomieniami tpay) odpowiadają tylko
 * adresom z `KANCELARIA_ADRESY`. `zad.ip` pochodzi z nagłówka ustawianego przez nginx (`trust proxy`).
 */
const TRASY_PUBLICZNE = ['/api/wspolne', '/api/psa/portal', '/api/psa/platnosci'];
aplikacja.use('/api', (zad, odp, dalej) => {
  const sciezka = zad.originalUrl.split('?')[0];
  if (TRASY_PUBLICZNE.some((p) => sciezka === p || sciezka.startsWith(`${p}/`))) return dalej();
  if (adresy.nalezy(zad.ip, konfiguracja.KANCELARIA_ADRESY)) return dalej();
  return odp.status(403).json({ blad: 'Dostęp tylko z sieci kancelarii.' });
});

/**
 * Routery API: [prefiks, plik w `server/trasy/`, bramka]. Jedna lista dla montowania, testu listy
 * dozwolonych tras (`testy/trasy-dozwolone.txt`, § 7 pkt 1) i `npm run dokumentacja`. Kolejność ma
 * znaczenie: `/api/psa` (pozostałe) na końcu.
 */
const ROUTERY_API = [
  ['/api/wspolne', 'wspolne', null],
  ['/api/psa/auth', 'auth', null],
  ['/api/psa/portal', 'portal', bramkaPortalu],
  ['/api/psa/platnosci', 'platnosci', null],
  ['/api/psa/spolki', 'spolki', autoryzacja.wymagajPracownika],
  ['/api/psa/osoby', 'osoby', autoryzacja.wymagajPracownika],
  ['/api/psa/sprawy', 'sprawy', autoryzacja.wymagajPracownika],
  ['/api/psa/pliki', 'pliki', autoryzacja.wymagajPracownika],
  ['/api/psa/korespondencja', 'korespondencja', autoryzacja.wymagajPracownika],
  ['/api/psa/oplaty', 'oplaty', autoryzacja.wymagajPracownika],
  ['/api/psa/wnioski', 'wnioski', autoryzacja.wymagajPracownika],
  ['/api/psa', 'pozostale', null],
].map(([prefiks, plik, bramka]) => ({ prefiks, plik, bramka, router: require(`./server/trasy/${plik}`) }));
for (const r of ROUTERY_API) aplikacja.use(r.prefiks, ...(r.bramka ? [r.bramka] : []), r.router);

// ── Statyki ──────────────────────────────────────────────────────────────
// Moduł ma wlasna tozsamosc wizualna w /style/rejestr.css (sesja 6, faza 1) -
// `design.css` zostal z niego wygaszony i nie jest juz serwowany.
// Portal klienta to OSOBNA aplikacja jednostronicowa (wlasny routing na
// hashu, wlasna sesja) - jawny routing na wypadek koncowego "/", ktorego
// `express.static` z opcja `extensions` nie rozwiazuje do pliku.
/**
 * Strona aplikacji. W trybie testowym dostaje dwa skrypty przed paczka:
 * stan trybu (konta testowe, data) i czerwony pasek — poza nim plik idzie
 * bez zmian.
 */
function wyslijStrone(odp, plik) {
  const pelna = path.join(__dirname, 'publiczne', plik);
  if (!konfiguracja.TRYB_TESTOWY) return odp.sendFile(pelna);
  const html = fs.readFileSync(pelna, 'utf8').replace(
    '<script',
    '<script src="/test/konfiguracja.js"></script>\n  <script src="/test/pasek.js" defer></script>\n  <script'
  );
  return odp.type('html').set('Cache-Control', 'no-store').send(html);
}

if (konfiguracja.TRYB_TESTOWY) {
  aplikacja.get(['/', '/index.html'], (zad, odp) => wyslijStrone(odp, 'index.html'));
  aplikacja.get('/portal.html', (zad, odp) => wyslijStrone(odp, 'portal.html'));
}
aplikacja.get(['/portal', '/portal/'], (zad, odp) => {
  wyslijStrone(odp, 'portal.html');
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
aplikacja.use(['/obrazy', '/style', '/js', '/vendor', '/dist', '/fonty'], (zad, odp) => {
  odp.status(404).type('text/plain').send('Nie odnaleziono pliku.');
});

// Pozostale sciezki obsluguje aplikacja jednostronicowa.
aplikacja.get('*', (zad, odp) => {
  wyslijStrone(odp, 'index.html');
});

aplikacja.use(posrednikBledow);

// ─────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  require('./server/trasy/auth').zapewnijAdmina(db(), konfiguracja.ADMIN_EMAIL).finally(() => {
    if (trybTestowy) trybTestowy.ustawAtrapeTpay(konfiguracja.PORT);
    aplikacja.listen(konfiguracja.PORT, konfiguracja.HOST, () => {
      if (konfiguracja.TRYB_TESTOWY) {
        console.log('[psa] ══ TRYB TESTOWY — e-maile nie są wysyłane (skrzynka: /test/skrzynka, panel: /test) ══');
      }
      console.log(`[psa] Rejestr akcjonariuszy P.S.A. — http://localhost:${konfiguracja.PORT}`);
      console.log(`[psa] baza: ${konfiguracja.WSPOLNA_BAZA}`);
      console.log(`[psa] portal klienta: ${konfiguracja.PORTAL_WLACZONY ? 'włączony' : 'wyłączony (PORTAL_WLACZONY=false)'}`);
    });
    uruchomProcesDzienny(db());
  });
}

module.exports = aplikacja;
module.exports.ROUTERY_API = ROUTERY_API;
