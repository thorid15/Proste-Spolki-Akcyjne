'use strict';

/**
 * Automatyczny tester przepływów (SESJA-PSA-ANALIZA-PRZEPLYWOW, Faza 2).
 *
 *   npm run e2e         — scenariusze (testy/e2e/scenariusze/*.spec.js), każdy przy 1440 i 390 px
 *   npm run e2e:malpa   — „małpa”: każdy aktywny przycisk/link głównych ekranów w świeżym stanie
 *
 * Każdy test ma własny serwer w TRYBIE TESTOWYM na świeżej bazie z `test:seed` (pomocnicze/srodowisko.js);
 * strażnik przerywa test bez trybu testowego i bez skrzynki testowej. Wynik: testy/e2e/raport/wyniki.json
 * i arkusze zbiorcze zrzutów testy/e2e/raport/arkusze/*.png.
 * Regresja: `npm run e2e` przed każdym STOP w kolejnych sesjach.
 */

const { defineConfig } = require('@playwright/test');

const MALPA = process.env.PSA_E2E_TRYB === 'malpa'; // ustawia e2e-malpa.config.js

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: MALPA ? /malpa\.spec\.js$/ : /scenariusze\/.*\.spec\.js$/,
  timeout: MALPA ? 15 * 60 * 1000 : 180000,
  workers: Number(process.env.PSA_E2E_WATKI || 4),
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  globalSetup: require.resolve('./pomocnicze/e2e-start.js'),
  globalTeardown: require.resolve('./pomocnicze/e2e-koniec.js'),
  use: { browserName: 'chromium', locale: 'pl-PL', timezoneId: 'Europe/Warsaw', actionTimeout: 15000 },
  projects: MALPA
    ? [{ name: 'malpa', use: { viewport: { width: 1440, height: 900 } } }]
    : [
      { name: '1440', use: { viewport: { width: 1440, height: 900 } } },
      { name: '390', use: { viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: false } },
    ],
});
