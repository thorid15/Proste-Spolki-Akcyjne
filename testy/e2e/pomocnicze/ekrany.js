'use strict';

/** Wspólne dla zrzutów i testów układu: logowanie kontem testowym i lista ekranów (dane z `test:seed`). */

const HASLO = 'Test-Haslo-2026';

async function zaloguj(page, email, aplikacja) {
  const trasa = aplikacja === 'kancelaria' ? '/api/psa/auth/login' : '/api/psa/portal/login';
  const odp = await page.request.post(trasa, { data: { email, haslo: HASLO, droga_testowa: 'formularz' } });
  if (!odp.ok()) throw new Error(`logowanie ${email}: ${odp.status()} ${await odp.text()}`);
}

/** Ekrany kancelarii (§ 5); portal — Faza 5. `czekaj` — selektor, po którym ekran jest gotowy. */
const K = 'notariusz@example.com';
const EKRANY = [
  { nazwa: 'kancelaria-pulpit', konto: K, aplikacja: 'kancelaria', adres: '/#/', czekaj: 'text=Do zrobienia' },
  { nazwa: 'kancelaria-sprawa', konto: K, aplikacja: 'kancelaria', adres: '/#/sprawy/2', czekaj: 'text=Osoby do powiadomienia' },
  { nazwa: 'kancelaria-kokpit', konto: K, aplikacja: 'kancelaria', adres: '/#/spolki/1', czekaj: 'text=Akcjonariusze' },
  { nazwa: 'kancelaria-osoba', konto: K, aplikacja: 'kancelaria', adres: '/#/osoby/2', czekaj: '.karta' },
  { nazwa: 'kancelaria-korespondencja', konto: K, aplikacja: 'kancelaria', adres: '/#/korespondencja', czekaj: '.karta' },
  { nazwa: 'kancelaria-oplaty', konto: K, aplikacja: 'kancelaria', adres: '/#/oplaty', czekaj: '.karta' },
];

module.exports = { zaloguj, EKRANY, HASLO };
