'use strict';

/** Po `npm run e2e`: wyniki.json i arkusze zbiorcze; krótkie podsumowanie na konsolę. */

const { chromium } = require('@playwright/test');
const { arkusze, scal } = require('./arkusz');

module.exports = async () => {
  const browser = await chromium.launch();
  try {
    if (process.env.PSA_E2E_TRYB !== 'malpa') await arkusze(browser);
  } finally {
    await browser.close();
  }
  const { scenariusze, malpa } = scal();
  const przerwane = scenariusze.filter((s) => s.status !== 'ukonczony').map((s) => `${s.scenariusz}@${s.szerokosc}`);
  const bledy = scenariusze.reduce((n, s) => n + s.bledy.js.length + s.bledy.http.length, 0);
  console.log(`\n[e2e] scenariusze: ${scenariusze.length} (przerwane: ${przerwane.join(', ') || '—'}), błędy JS/HTTP: ${bledy}; małpa: ${malpa.length} ekranów`);
  console.log('[e2e] wynik: testy/e2e/raport/wyniki.json, arkusze: testy/e2e/raport/arkusze/');
};
