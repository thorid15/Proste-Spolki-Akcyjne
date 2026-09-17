'use strict';
const { ADRES, KLIENT_STORAGE, launch } = require('./lib');
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KLIENT_STORAGE });
  const page = await ctx.newPage();
  await page.goto(`${ADRES}/portal.html#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const html = await page.content();
  require('fs').writeFileSync('/home/user/Proste-Spolki-Akcyjne/testy-audyt/skrypty/_dump.html', html);
  console.log('saved, url=', page.url());
  await browser.close();
})();
