'use strict';
const { ADRES, KLIENT_STORAGE, KANC_STORAGE, writeState, shot, launch } = require('./lib');

const ZNACZNIK = Date.now().toString().slice(-6);
const EMAIL_KLIENTA = `audyt.s1.${ZNACZNIK}@example-test.pl`;
const KRS_SPOLKI = `0000${ZNACZNIK}`.padEnd(10, '0').slice(0, 10);
const HASLO_KLIENTA = 'HasloKlientaS1-123!';
const HASLO_ADMIN = 'St1wcbi9aU-QXg';
const ADMIN_EMAIL = 'audyt@kancelaria.test';
const DZIS = new Date().toISOString().slice(0, 10);

(async () => {
  const browser = await launch();
  console.log('EMAIL_KLIENTA', EMAIL_KLIENTA, 'KRS', KRS_SPOLKI);

  let linkAktywacyjny = null;
  const klientCtx = await browser.newContext();
  const klient = await klientCtx.newPage();
  klient.on('response', async (resp) => {
    if (resp.url().includes('/api/psa/portal/zgloszenia') && resp.request().method() === 'POST') {
      try {
        const j = await resp.json();
        linkAktywacyjny = j.link_aktywacyjny;
        console.log('CAPTURED link_aktywacyjny:', linkAktywacyjny, 'zaproszenie_wyslane=', j.zaproszenie_wyslane);
      } catch (e) { console.log('parse err', e.message); }
    }
  });

  await klient.goto(`${ADRES}/portal.html#/zglos-sie`, { waitUntil: 'networkidle' });
  await klient.getByLabel('E-mail').fill(EMAIL_KLIENTA);
  await klient.getByLabel('Numer KRS spółki').fill(KRS_SPOLKI);
  await klient.getByLabel('Nazwa spółki').fill(`Audyt S1 ${ZNACZNIK} P.S.A.`);
  await shot(klient, 'zgloszenie-wypelniony');
  await klient.getByRole('button', { name: 'Wyślij zgłoszenie' }).click();
  await klient.waitForTimeout(1200);
  await shot(klient, 'zgloszenie-potwierdzenie');

  if (!linkAktywacyjny) throw new Error('Nie przechwycono linku aktywacyjnego — być może SMTP jest skonfigurowany.');

  await klient.goto(`${ADRES}${linkAktywacyjny.replace(ADRES, '')}`, { waitUntil: 'networkidle' });
  await shot(klient, 'aktywacja-formularz');
  const passInputs = klient.locator('input[type=password]');
  const n = await passInputs.count();
  console.log('liczba pol hasla:', n);
  await passInputs.nth(0).fill(HASLO_KLIENTA);
  if (n > 1) await passInputs.nth(1).fill(HASLO_KLIENTA);
  await shot(klient, 'aktywacja-wypelniony');
  const aktywujBtn = klient.getByRole('button', { name: /aktywuj|ustaw hasło|zaloguj|dalej|potwierd/i }).first();
  await aktywujBtn.click();
  await klient.waitForTimeout(1200);
  await shot(klient, 'aktywacja-po-zalogowaniu');
  console.log('URL po aktywacji:', klient.url());

  await klientCtx.storageState({ path: KLIENT_STORAGE });

  // ── Kancelaria: login ──
  const kancCtx = await browser.newContext();
  const kanc = await kancCtx.newPage();
  await kanc.goto(`${ADRES}/`, { waitUntil: 'networkidle' });
  const emailInput = kanc.locator('input[type=email]').first();
  await emailInput.fill(ADMIN_EMAIL);
  await kanc.locator('input[type=password]').first().fill(HASLO_ADMIN);
  await kanc.getByRole('button', { name: /zaloguj/i }).click();
  await kanc.waitForTimeout(1000);
  await shot(kanc, 'kancelaria-zalogowana');
  await kancCtx.storageState({ path: KANC_STORAGE });

  writeState({ ZNACZNIK, EMAIL_KLIENTA, KRS_SPOLKI, HASLO_KLIENTA, HASLO_ADMIN, ADMIN_EMAIL, DZIS });
  console.log('=== 01 OK ===');
  await browser.close();
})().catch((e) => { console.error('BLAD 01:', e); process.exit(1); });
