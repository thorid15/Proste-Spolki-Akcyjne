'use strict';
const { ADRES, KANC_STORAGE, readState, shot, launch } = require('./lib');

(async () => {
  const st = readState();
  const { SPOLKA_ID } = st;
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await ctx.newPage();

  await kanc.goto(`${ADRES}/#/spolki/${SPOLKA_ID}`, { waitUntil: 'networkidle' });
  await shot(kanc, 'kokpit-spolki-z-jednym-zdarzeniem-testowym');

  const migracjaBtn = kanc.getByRole('button', { name: /migracja/i });
  console.log('Przycisk Migracja widoczny:', await migracjaBtn.count());

  await kanc.locator('text=Rejestr akcji').first().click();
  await kanc.waitForTimeout(400);
  await shot(kanc, 'kokpit-rejestr-akcji-rozwiniety');

  const nowaEmisjaBtn = kanc.getByRole('button', { name: /nowa emisja/i });
  console.log('Przycisk "Nowa emisja" widoczny:', await nowaEmisjaBtn.count());
  await nowaEmisjaBtn.click();
  await kanc.waitForTimeout(800);
  await shot(kanc, 'nowa-emisja-krok1');
  console.log('URL:', kanc.url());

  await browser.close();
})().catch((e) => { console.error('BLAD 07b:', e); process.exit(1); });
