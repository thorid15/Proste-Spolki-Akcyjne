'use strict';
const { ADRES, KANC_STORAGE, readState, shot, launch } = require('./lib');

(async () => {
  const st = readState();
  const { SPOLKA_ID } = st;
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await ctx.newPage();
  await kanc.goto(`${ADRES}/#/spolki/${SPOLKA_ID}`, { waitUntil: 'networkidle' });
  await kanc.reload({ waitUntil: 'networkidle' });
  await kanc.waitForTimeout(500);
  await shot(kanc, 'kokpit-rejestr-otwarty-95-5-CORRECT');
  await kanc.locator('text=Rejestr akcji').first().click();
  await kanc.waitForTimeout(300);
  await shot(kanc, 'kokpit-rejestr-akcji-detale');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
