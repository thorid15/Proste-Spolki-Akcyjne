'use strict';
const { ADRES, KANC_STORAGE, readState, shot, launch } = require('./lib');

(async () => {
  const st = readState();
  const { AKCJONARIUSZE } = st;
  const osobaInwestor = AKCJONARIUSZE.find((a) => a.typ === 'prawna').osoba_id;
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await ctx.newPage();

  await kanc.goto(`${ADRES}/#/osoby/${osobaInwestor}`, { waitUntil: 'networkidle' });
  await kanc.waitForTimeout(500);
  await shot(kanc, 'kartoteka-osoby-inwestor-szczegoly');
  const tekst = await kanc.locator('body').innerText();
  console.log('Czy strona wspomina "konto"/"portal":', /konto|portal/i.test(tekst));
  console.log(tekst.slice(0, 1500));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
