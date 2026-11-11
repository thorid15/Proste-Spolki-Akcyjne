'use strict';
const { ADRES, shot, launch, fillPole } = require('./lib');

const ZNACZNIK = Date.now().toString().slice(-6);
const EMAIL = `audyt.wstecz2.${ZNACZNIK}@example-test.pl`;
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
  await page.goto(`${ADRES}${link.replace(ADRES, '')}`, { waitUntil: 'networkidle' });
  const pass = page.locator('input[type=password]');
  await pass.nth(0).fill('HasloWstecz2-123!');
  await pass.nth(1).fill('HasloWstecz2-123!');
  await page.getByRole('button', { name: /aktywuj|ustaw hasło|zaloguj|dalej|potwierd/i }).first().click();
  await page.waitForTimeout(1000);
  const dalejRodo = page.getByRole('button', { name: /przejdź dalej/i });
  if (await dalejRodo.count()) {
    await page.locator('input[type=checkbox]').first().check();
    await dalejRodo.click();
    await page.waitForTimeout(600);
  }

  console.log('--- WARIANT A: krotki odstep (500ms) przed nawigacja - powtorka kontrolna ---');
  await fillPole(page, 'Firma (nazwa) spółki', 'Test Wstecz KROTKO');
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  let tekst = await page.locator('body').innerText();
  console.log('Po 500ms + F5 - dane przetrwaly?:', tekst.includes('Test Wstecz KROTKO'));

  console.log('\n--- WARIANT B: dluzszy odstep (1500ms > 800ms debounce) przed nawigacja ---');
  await fillPole(page, 'Firma (nazwa) spółki', 'Test Wstecz DLUGO');
  await shot(page, 'kontrola-wypelnione-przed-czekaniem');
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  tekst = await page.locator('body').innerText();
  console.log('Po 1500ms + F5 - dane przetrwaly?:', tekst.includes('Test Wstecz DLUGO'));
  await shot(page, 'kontrola-po-f5-dlugo');

  await browser.close();
  console.log('=== 10b OK ===');
})().catch((e) => { console.error('BLAD 10b:', e); process.exit(1); });
