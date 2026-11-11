'use strict';
const { ADRES, shot, launch, fillPole, poleByLabel } = require('./lib');

const ZNACZNIK = Date.now().toString().slice(-6);
const EMAIL = `audyt.wstecz3.${ZNACZNIK}@example-test.pl`;
const KRS = `0000${ZNACZNIK}`.padEnd(10, '0').slice(0, 10);

async function wartoscPola(page, etykieta) {
  return poleByLabel(page, etykieta).locator('input').first().inputValue();
}

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
  await pass.nth(0).fill('HasloWstecz3-123!');
  await pass.nth(1).fill('HasloWstecz3-123!');
  await page.getByRole('button', { name: /aktywuj|ustaw hasło|zaloguj|dalej|potwierd/i }).first().click();
  await page.waitForTimeout(1000);
  const dalejRodo = page.getByRole('button', { name: /przejdź dalej/i });
  if (await dalejRodo.count()) {
    await page.locator('input[type=checkbox]').first().check();
    await dalejRodo.click();
    await page.waitForTimeout(600);
  }

  console.log('--- Odstep KROTSZY niz debounce (300ms) przed F5 ---');
  await fillPole(page, 'Firma (nazwa) spółki', 'Szybki-300ms');
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  console.log('Wartosc pola po F5 (300ms):', JSON.stringify(await wartoscPola(page, 'Firma (nazwa) spółki')));

  console.log('\n--- Odstep DLUZSZY niz debounce (1200ms) przed F5 ---');
  await fillPole(page, 'Firma (nazwa) spółki', 'Wolny-1200ms');
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  console.log('Wartosc pola po F5 (1200ms):', JSON.stringify(await wartoscPola(page, 'Firma (nazwa) spółki')));

  await shot(page, 'wstecz-poprawny-test-koncowy');
  await browser.close();
  console.log('=== 10c OK ===');
})().catch((e) => { console.error('BLAD 10c:', e); process.exit(1); });
