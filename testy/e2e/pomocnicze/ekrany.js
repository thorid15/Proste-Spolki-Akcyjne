'use strict';

/** Wspólne dla zrzutów i testów układu: logowanie kontem testowym i lista ekranów (dane z `test:seed`). */

const HASLO = 'Test-Haslo-2026';

async function zaloguj(page, email, aplikacja) {
  const trasa = aplikacja === 'kancelaria' ? '/api/psa/auth/login' : '/api/psa/portal/login';
  const odp = await page.request.post(trasa, { data: { email, haslo: HASLO, droga_testowa: 'formularz' } });
  if (!odp.ok()) throw new Error(`logowanie ${email}: ${odp.status()} ${await odp.text()}`);
}

/** Ekrany z SESJA-PSA-POPRAWKI-R4 (P1–P5, K1–K4). `czekaj` — selektor, po którym ekran jest gotowy. */
const EKRANY = [
  { nazwa: 'portal-start', konto: 'zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/', czekaj: '.karta' },
  { nazwa: 'portal-rejestr', konto: 'zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/spolka/1', czekaj: 'text=Dane spółki' },
  { nazwa: 'portal-informacja', konto: 'zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/informacja/1', czekaj: 'text=Stan na dzień' },
  { nazwa: 'portal-oswiadczenia', konto: 'anna.zgoda@example.com', aplikacja: 'portal', adres: '/portal.html#/konto', czekaj: 'text=Moje oświadczenia' },
  { nazwa: 'kancelaria-sprawa', konto: 'notariusz@example.com', aplikacja: 'kancelaria', adres: '/#/sprawy/1', czekaj: 'text=Uprzednie powiadomienie' },
  { nazwa: 'kancelaria-osoba', konto: 'notariusz@example.com', aplikacja: 'kancelaria', adres: '/#/osoby/2', czekaj: '.karta' },
  { nazwa: 'kancelaria-listy', konto: 'notariusz@example.com', aplikacja: 'kancelaria', adres: '/#/listy', czekaj: '.karta' },
];

module.exports = { zaloguj, EKRANY, HASLO };
