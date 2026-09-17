'use strict';
const { ADRES, KLIENT_STORAGE, shot, launch, fillPole } = require('./lib');

const ZNACZNIK = Date.now().toString().slice(-6);
const EMAIL = `audyt.wstecz.${ZNACZNIK}@example-test.pl`;
const KRS = `0000${ZNACZNIK}`.padEnd(10, '0').slice(0, 10);

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let link = null;
  page.on('response', async (r) => {
    if (r.url().includes('/api/psa/portal/zgloszenia') && r.request().method() === 'POST') {
      try { link = (await r.json()).link_aktywacyjny; } catch {}
    }
  });

  await page.goto(`${ADRES}/portal.html#/zglos-sie`, { waitUntil: 'networkidle' });
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Numer KRS spółki').fill(KRS);
  await page.getByRole('button', { name: 'Wyślij zgłoszenie' }).click();
  await page.waitForTimeout(1000);
  if (!link) throw new Error('brak linku');

  await page.goto(`${ADRES}${link.replace(ADRES, '')}`, { waitUntil: 'networkidle' });
  const pass = page.locator('input[type=password]');
  await pass.nth(0).fill('HasloWstecz-123!');
  await pass.nth(1).fill('HasloWstecz-123!');
  await page.getByRole('button', { name: /aktywuj|ustaw hasło|zaloguj|dalej|potwierd/i }).first().click();
  await page.waitForTimeout(1000);

  // RODO
  const dalejRodo = page.getByRole('button', { name: /przejdź dalej/i });
  if (await dalejRodo.count()) {
    await page.locator('input[type=checkbox]').first().check();
    await dalejRodo.click();
    await page.waitForTimeout(600);
  }

  await fillPole(page, 'Firma (nazwa) spółki', 'Test Wstecz P.S.A.');
  await shot(page, 'wstecz-krok0-wypelniony-czesciowo');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'wstecz-krok1-po-dalej');
  console.log('URL na kroku 1:', page.url());

  // Przycisk WSTECZ przegladarki
  await page.goBack({ waitUntil: 'networkidle' }).catch((e) => console.log('goBack error:', e.message));
  await page.waitForTimeout(800);
  await shot(page, 'wstecz-po-przycisku-wstecz-przegladarki');
  console.log('URL po wstecz przegladarki:', page.url());
  const tekstPoWstecz = await page.locator('body').innerText();
  console.log('Czy strona nadal pokazuje wniosek (zawiera "Wniosek o prowadzenie"):', tekstPoWstecz.includes('Wniosek o prowadzenie'));
  console.log('Czy widac "Firma (nazwa) spółki" nadal wypelnione (Test Wstecz):', tekstPoWstecz.includes('Test Wstecz'));

  // F5 po powrocie
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot(page, 'wstecz-po-f5');
  const tekstPoF5 = await page.locator('body').innerText();
  console.log('Po F5 - czy dane spolki przetrwaly (Test Wstecz):', tekstPoF5.includes('Test Wstecz'));

  // Sprawdzmy czy nie powstal DUPLIKAT wniosku/zgloszenia dla tego samego KRS
  const listaZgl = await ctx.request.get(`${ADRES}/api/psa/zgloszenia`, {
    // ta trasa wymaga sesji pracownika - pomijamy, sprawdzimy inaczej przez wniosek klienta
  }).catch(() => null);

  await browser.close();
  console.log('=== 10 OK ===');
})().catch((e) => { console.error('BLAD 10:', e); process.exit(1); });
