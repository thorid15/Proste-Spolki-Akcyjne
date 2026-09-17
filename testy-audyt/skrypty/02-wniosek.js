'use strict';
const {
  ADRES, KLIENT_STORAGE, readState, writeState, shot, launch,
  fillPole, selectPole, fillData, checkPrzelacznik,
} = require('./lib');

(async () => {
  const st = readState();
  const { KRS_SPOLKI, ZNACZNIK, DZIS, EMAIL_KLIENTA } = st;
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KLIENT_STORAGE });
  const klient = await ctx.newPage();
  klient.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });

  await klient.goto(`${ADRES}/portal.html#/`, { waitUntil: 'networkidle' });
  const dalejRodo = klient.getByRole('button', { name: /przejdź dalej/i });
  if (await dalejRodo.count()) {
    await shot(klient, 'rodo-ekran');
    const rodoChk = klient.locator('input[type=checkbox]').first();
    await rodoChk.check();
    await shot(klient, 'rodo-zaznaczone');
    await dalejRodo.click();
    await klient.waitForTimeout(800);
  } else {
    console.log('RODO juz zaakceptowane wczesniej — pomijam ekran.');
  }
  await shot(klient, 'wniosek-krok0-puste');

  // ── Krok 0: Dane spółki ──
  await fillPole(klient, 'Numer KRS', KRS_SPOLKI);
  await fillPole(klient, 'Firma (nazwa) spółki', `Audyt S1 ${ZNACZNIK} Prosta Spółka Akcyjna`);
  await fillPole(klient, 'Kod pocztowy', '80-280');
  await fillPole(klient, 'Miejscowość', 'Gdańsk');
  await fillPole(klient, 'Ulica', 'Testowa');
  await fillPole(klient, 'Nr domu', '1');
  await fillPole(klient, 'Sąd rejestrowy', 'Sąd Rejonowy Gdańsk-Północ w Gdańsku, VII Wydział Gospodarczy KRS');
  await fillPole(klient, 'Wydział', 'VII Wydział Gospodarczy KRS');
  await selectPole(klient, 'Organ zarządzający', 'zarzad');
  await fillData(klient, 'Data rejestracji w KRS', DZIS);
  await fillPole(klient, 'Kapitał akcyjny', '1');
  await fillData(klient, 'Data zawarcia umowy spółki', DZIS);
  await fillPole(klient, 'Adres e-mail spółki', EMAIL_KLIENTA);
  await shot(klient, 'wniosek-krok0-wypelniony');
  await klient.getByRole('button', { name: 'Dalej' }).click();
  await klient.waitForTimeout(500);

  // ── Krok 1: Reprezentant ──
  await shot(klient, 'wniosek-krok1-puste');
  await fillPole(klient, 'Imię i nazwisko', 'Anna Kowalska');
  await fillPole(klient, 'Funkcja', 'Prezes Zarządu (zarząd jednoosobowy)');
  await fillPole(klient, 'PESEL', '85010112345');
  await fillPole(klient, 'Dowód osobisty', 'ABC123456');
  await fillPole(klient, 'Imiona rodziców', 'Jan i Maria');
  await fillPole(klient, 'Adres zamieszkania', 'ul. Testowa 1, 80-280 Gdańsk');
  await fillPole(klient, 'Adres e-mail', EMAIL_KLIENTA);
  await shot(klient, 'wniosek-krok1-wypelniony');
  await klient.getByRole('button', { name: 'Dalej' }).click();
  await klient.waitForTimeout(500);

  // ── Krok 2: Akcjonariusze ──
  await shot(klient, 'wniosek-krok2-pusta-lista');
  await klient.getByRole('button', { name: 'Dodaj akcjonariusza' }).click();
  await klient.waitForTimeout(600);
  await shot(klient, 'wniosek-akcjonariusz1-formularz');

  // Akcjonariusz 1: osoba fizyczna, Anna Kowalska (docelowo 95 akcji)
  await fillPole(klient, 'Imię', 'Anna');
  await fillPole(klient, 'Nazwisko', 'Kowalska');
  await fillPole(klient, 'PESEL', '85010112345');
  await fillData(klient, 'Data urodzenia', '1985-01-01');
  await fillPole(klient, 'Kod pocztowy', '80-280');
  await fillPole(klient, 'Miejscowość', 'Gdańsk');
  await fillPole(klient, 'Ulica', 'Testowa');
  await fillPole(klient, 'Nr domu', '1');
  await fillPole(klient, 'Adres e-mail', EMAIL_KLIENTA);
  await checkPrzelacznik(klient, 'Akcjonariusz wyraża zgodę na komunikację elektroniczną');
  await shot(klient, 'wniosek-akcjonariusz1-wypelniony');
  await klient.getByRole('button', { name: 'Gotowe' }).click();
  await klient.waitForTimeout(700);

  // Akcjonariusz 2: osoba prawna (docelowo 5 akcji)
  await shot(klient, 'wniosek-krok2-lista-po-pierwszym');
  await klient.getByRole('button', { name: 'Dodaj kolejnego akcjonariusza' }).click();
  await klient.waitForTimeout(600);
  await selectPole(klient, 'Rodzaj podmiotu', 'prawna');
  const emailWspolnikPrawny = `wspolnik.prawny.${ZNACZNIK}@example-test.pl`;
  await fillPole(klient, 'Firma (nazwa)', `Inwestor ${ZNACZNIK} Sp. z o.o.`);
  await fillPole(klient, 'Numer we właściwym rejestrze', `0000${ZNACZNIK}`.padEnd(10, '9').slice(0, 10));
  await fillPole(klient, 'Nazwa rejestru', 'Krajowy Rejestr Sądowy — rejestr przedsiębiorców');
  await fillPole(klient, 'NIP', '1234563218');
  await fillPole(klient, 'Kod pocztowy', '00-001');
  await fillPole(klient, 'Miejscowość', 'Warszawa');
  await fillPole(klient, 'Ulica', 'Inwestorska');
  await fillPole(klient, 'Nr domu', '5');
  await fillPole(klient, 'Adres e-mail', emailWspolnikPrawny);
  await shot(klient, 'wniosek-akcjonariusz2-wypelniony');
  await klient.getByRole('button', { name: 'Gotowe' }).click();
  await klient.waitForTimeout(700);
  await shot(klient, 'wniosek-krok2-lista-dwoch');

  await klient.getByRole('button', { name: 'Dalej' }).click();
  await klient.waitForTimeout(600);

  // ── Krok 3: Podsumowanie + Złożenie ──
  await shot(klient, 'wniosek-krok3-podsumowanie');
  await klient.getByRole('button', { name: /złóż wniosek/i }).click();
  await klient.waitForTimeout(1200);
  await shot(klient, 'wniosek-zlozony');
  console.log('URL po zlozeniu:', klient.url());

  await ctx.storageState({ path: KLIENT_STORAGE });
  writeState({ EMAIL_WSPOLNIK_PRAWNY: emailWspolnikPrawny });
  console.log('=== 02 OK ===');
  await browser.close();
})().catch(async (e) => {
  console.error('BLAD 02:', e);
  process.exit(1);
});
