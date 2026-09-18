'use strict';

/**
 * Testy integracyjne logowania pracownikow kancelarii przez HTTP
 * (sekcja 8 i 11 specyfikacji, odstepstwo nr 2 z sekcji 2).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-auth-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-auth-dokumenty');
process.env.ADMIN_EMAIL = 'admin-test@example.pl';

const app = require('../serwer');
const { db } = require('../server/baza');
const auth = require('../server/trasy/auth');

let serwer;
let baza;
let hasloAdmina;

test.before(async () => {
  await auth.zapewnijAdmina(db(), process.env.ADMIN_EMAIL);
  // `zapewnijAdmina` wypisuje haslo tylko na konsole - do testu czytamy je
  // wprost z zapytania: ustawiamy znane haslo bezposrednio w bazie.
  const hasla = require('../server/logika/hasla');
  hasloAdmina = 'HasloAdmina123';
  const hash = await hasla.hashuj(hasloAdmina);
  db().prepare(`UPDATE psa_uzytkownicy SET hash_hasla = ? WHERE email = ?`).run(hash, process.env.ADMIN_EMAIL);

  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

test('bootstrap admina: utworzone dokladnie jedno konto z ADMIN_EMAIL', () => {
  const wiersze = db().prepare('SELECT * FROM psa_uzytkownicy').all();
  assert.equal(wiersze.length, 1);
  assert.equal(wiersze[0].email, process.env.ADMIN_EMAIL);
  assert.equal(wiersze[0].rola, 'admin');
});

test('logowanie: bledne haslo zwraca 401, poprawne ustawia sesje', async () => {
  const zle = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: 'cos-zlego-123' }),
  });
  assert.equal(zle.status, 401);

  const ok = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  assert.equal(ok.status, 200);
  const ciastko = ciasteczkoZOdpowiedzi(ok);
  assert.match(ciastko, /^psa_sesja=/);

  const kto = await fetch(`${baza}/api/psa/auth/whoami`, { headers: { Cookie: ciastko } });
  const ktoOdp = await kto.json();
  assert.equal(ktoOdp.zalogowany, true);
  assert.equal(ktoOdp.uzytkownik.email, process.env.ADMIN_EMAIL);
});

test('trasy kancelaryjne wymagaja sesji pracownika', async () => {
  const bez = await fetch(`${baza}/api/psa/pulpit`);
  assert.equal(bez.status, 401);

  const login = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  const ciastko = ciasteczkoZOdpowiedzi(login);

  const z = await fetch(`${baza}/api/psa/pulpit`, { headers: { Cookie: ciastko } });
  assert.equal(z.status, 200);
});

test('rate limiting: blokuje logowanie po 5 nieudanych probach', async () => {
  const email = 'limiter-test@example.pl';
  for (let i = 0; i < 5; i += 1) {
    const odp = await fetch(`${baza}/api/psa/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, haslo: 'zle-haslo' }),
    });
    assert.equal(odp.status, 401);
  }
  const zablokowany = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo: 'zle-haslo' }),
  });
  assert.equal(zablokowany.status, 429);
});

test('admin: tworzy pracownika, ktory moze sie zalogowac; pracownik nie widzi listy uzytkownikow', async () => {
  const login = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  const ciastkoAdmina = ciasteczkoZOdpowiedzi(login);

  const utworz = await fetch(`${baza}/api/psa/auth/uzytkownicy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAdmina },
    body: JSON.stringify({ imie: 'Anna Pracownik', email: 'anna@example.pl', rola: 'pracownik' }),
  });
  assert.equal(utworz.status, 201);
  const utworzOdp = await utworz.json();
  assert.equal(typeof utworzOdp.haslo_tymczasowe, 'string');
  assert.equal(utworzOdp.haslo_tymczasowe.length >= 10, true);

  const loginPracownika = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'anna@example.pl', haslo: utworzOdp.haslo_tymczasowe }),
  });
  assert.equal(loginPracownika.status, 200);
  const ciastkoPracownika = ciasteczkoZOdpowiedzi(loginPracownika);

  const lista = await fetch(`${baza}/api/psa/auth/uzytkownicy`, { headers: { Cookie: ciastkoPracownika } });
  assert.equal(lista.status, 403);

  // Ale pracownik MOZE dokonywac wpisow - dostep do rdzenia kancelarii.
  const pulpit = await fetch(`${baza}/api/psa/pulpit`, { headers: { Cookie: ciastkoPracownika } });
  assert.equal(pulpit.status, 200);
});

test('admin nie moze zablokowac wlasnego konta', async () => {
  const login = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  const ciastko = ciasteczkoZOdpowiedzi(login);
  const whoami = await (await fetch(`${baza}/api/psa/auth/whoami`, { headers: { Cookie: ciastko } })).json();

  const odp = await fetch(`${baza}/api/psa/auth/uzytkownicy/${whoami.uzytkownik.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ciastko },
    body: JSON.stringify({ aktywny: false }),
  });
  assert.equal(odp.status, 400);
});

test('zmiana hasla: bledne obecne odrzucone, poprawne dziala i pozwala zalogowac sie nowym', async () => {
  const login = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  const ciastko = ciasteczkoZOdpowiedzi(login);

  const zle = await fetch(`${baza}/api/psa/auth/zmiana-hasla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastko },
    body: JSON.stringify({ haslo_obecne: 'nieprawidlowe', haslo_nowe: 'NoweHaslo123' }),
  });
  assert.equal(zle.status, 400);

  const zaKrotkie = await fetch(`${baza}/api/psa/auth/zmiana-hasla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastko },
    body: JSON.stringify({ haslo_obecne: hasloAdmina, haslo_nowe: 'krotkie' }),
  });
  assert.equal(zaKrotkie.status, 400);

  const ok = await fetch(`${baza}/api/psa/auth/zmiana-hasla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastko },
    body: JSON.stringify({ haslo_obecne: hasloAdmina, haslo_nowe: 'NoweHaslo123' }),
  });
  assert.equal(ok.status, 200);

  const staremNieDziala = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  assert.equal(staremNieDziala.status, 401);

  const nowymDziala = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: 'NoweHaslo123' }),
  });
  assert.equal(nowymDziala.status, 200);
  hasloAdmina = 'NoweHaslo123';
});

test('wylogowanie kasuje ciasteczko sesji po stronie przegladarki I uniewaznia biezacy token serwerowo (Z-250)', async () => {
  // Naglowek wylogowania (Set-Cookie, Max-Age=0) chroni normalna przegladarke,
  // ale token jest samodzielnie wazny do konca TTL (do 12h) az do naprawy
  // Z-250 — kopia ciastka sprzed wylogowania dzialala dalej. Sprawdzamy wiec
  // OBA mechanizmy: naglowek DLA przegladarki i odrzucenie tokenu na SERWERZE
  // (`whoami` z ta sama, zapamietana wartoscia ciastka).
  const login = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  const ciastko = ciasteczkoZOdpowiedzi(login);

  const przedWylogowaniem = await fetch(`${baza}/api/psa/auth/whoami`, { headers: { Cookie: ciastko } });
  assert.equal((await przedWylogowaniem.json()).zalogowany, true);

  const wylogowanie = await fetch(`${baza}/api/psa/auth/logout`, { method: 'POST', headers: { Cookie: ciastko } });
  const naglowekUsuniecia = wylogowanie.headers.get('set-cookie') || '';
  assert.match(naglowekUsuniecia, /psa_sesja=;/);
  assert.match(naglowekUsuniecia, /Max-Age=0/);

  // Ta sama, zapamietana wartosc ciastka (symulacja klienta, ktory zignorowal
  // Max-Age=0 albo skopiowal token wczesniej) — serwer musi go juz odrzucic.
  const poWylogowaniu = await fetch(`${baza}/api/psa/auth/whoami`, { headers: { Cookie: ciastko } });
  assert.equal((await poWylogowaniu.json()).zalogowany, false);
});

test('zmiana hasla uniewaznia WSZYSTKIE dotychczasowe tokeny konta, nie tylko to jedno uzyte do zmiany (Z-251)', async () => {
  const loginA = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  const ciastkoUrzadzeniaA = ciasteczkoZOdpowiedzi(loginA);

  // Drugie, niezalezne "urzadzenie" (osobny token, to samo konto).
  const loginB = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, haslo: hasloAdmina }),
  });
  const ciastkoUrzadzeniaB = ciasteczkoZOdpowiedzi(loginB);

  const zmiana = await fetch(`${baza}/api/psa/auth/zmiana-hasla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoUrzadzeniaA },
    body: JSON.stringify({ haslo_obecne: hasloAdmina, haslo_nowe: 'PoZmianieHasla123' }),
  });
  assert.equal(zmiana.status, 200);
  hasloAdmina = 'PoZmianieHasla123';

  const urzadzenieBPoZmianie = await fetch(`${baza}/api/psa/auth/whoami`, { headers: { Cookie: ciastkoUrzadzeniaB } });
  assert.equal(
    (await urzadzenieBPoZmianie.json()).zalogowany,
    false,
    'token innego, rownolegle zalogowanego urzadzenia musi przestac dzialac natychmiast po zmianie hasla'
  );
});
