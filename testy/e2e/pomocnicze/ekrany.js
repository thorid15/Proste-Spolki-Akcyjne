'use strict';

/** Wspólne dla zrzutów i testów układu: logowanie kontem testowym i lista ekranów (dane z `test:seed`). */

const HASLO = 'Test-Haslo-2026';

async function zaloguj(page, email, aplikacja) {
  const trasa = aplikacja === 'kancelaria' ? '/api/psa/auth/login' : '/api/psa/portal/login';
  const odp = await page.request.post(trasa, { data: { email, haslo: HASLO, droga_testowa: 'formularz' } });
  if (!odp.ok()) throw new Error(`logowanie ${email}: ${odp.status()} ${await odp.text()}`);
}

/** Ekrany kancelarii (§ 5) i portalu (wniosek — Faza 4; Start, Zgłoś zmianę, Konto — Faza 5). `czekaj` — selektor, po którym ekran jest gotowy. */
const K = 'notariusz@example.com';
const EKRANY = [
  { nazwa: 'kancelaria-pulpit', konto: K, aplikacja: 'kancelaria', adres: '/#/', czekaj: 'text=Do zrobienia' },
  { nazwa: 'kancelaria-sprawa', konto: K, aplikacja: 'kancelaria', adres: '/#/sprawy/2', czekaj: 'text=Osoby do powiadomienia' },
  { nazwa: 'kancelaria-kokpit', konto: K, aplikacja: 'kancelaria', adres: '/#/spolki/1', czekaj: 'text=Akcjonariusze' },
  { nazwa: 'kancelaria-osoba', konto: K, aplikacja: 'kancelaria', adres: '/#/osoby/2', czekaj: '.karta' },
  { nazwa: 'kancelaria-korespondencja', konto: K, aplikacja: 'kancelaria', adres: '/#/korespondencja', czekaj: '.karta' },
  { nazwa: 'kancelaria-oplaty', konto: K, aplikacja: 'kancelaria', adres: '/#/oplaty', czekaj: '.karta' },
  { nazwa: 'kancelaria-wniosek', konto: K, aplikacja: 'kancelaria', adres: '/#/wnioski/1', czekaj: 'text=Dokumenty' },
  { nazwa: 'portal-wniosek', konto: 'gamma.zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/', czekaj: 'text=dokumenty do podpisu' },
  { nazwa: 'portal-start-zarzad', konto: 'alfa.zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/', czekaj: 'text=Zgłoś zmianę' },
  { nazwa: 'portal-start-akcjonariusz', konto: 'anna.zgoda@example.com', aplikacja: 'portal', adres: '/portal.html#/', czekaj: 'text=Do zrobienia' },
  { nazwa: 'portal-zmiana', konto: 'alfa.zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/zmiana?spolka=1', czekaj: 'text=Co się zmieniło?' },
  { nazwa: 'portal-konto', konto: 'anna.zgoda@example.com', aplikacja: 'portal', adres: '/portal.html#/konto', czekaj: 'text=Zgoda na korespondencję e-mail' },
  { nazwa: 'portal-sprawy', konto: 'alfa.zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/sprawy', czekaj: 'text=Sprawy' },
  { nazwa: 'portal-platnosci', konto: 'anna.zgoda@example.com', aplikacja: 'portal', adres: '/portal.html#/platnosci', czekaj: 'text=Do zapłaty' },
  { nazwa: 'portal-informacja', konto: 'alfa.zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/informacja', czekaj: 'text=Wydane informacje' },
  { nazwa: 'portal-pomoc', konto: 'alfa.zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/pomoc', czekaj: 'text=Kontakt z kancelarią' },
  { nazwa: 'portal-wniosek-formularz', konto: 'epsilon.zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/', czekaj: 'text=Podsumowanie' },
  { nazwa: 'kancelaria-wniosek-przejecie', konto: K, aplikacja: 'kancelaria', adres: '/#/wnioski/3', czekaj: 'text=Decyzja' },
];

module.exports = { zaloguj, EKRANY, HASLO };
