'use strict';

/**
 * Zrzuty i kontrola układu (SESJA-PSA-POPRAWKI-R4, zadanie 0). `npm run zrzuty`.
 * Serwer w TRYBIE TESTOWYM na osobnej bazie (`dane-testowe/zrzuty/`) — nie nadpisuje bazy testowej.
 * Na nowym komputerze raz: `npx playwright install chromium`.
 */

const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.PSA_ZRZUTY_PORT || 3105);

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js$/,
  // Scenariusze i małpa mają własne konfiguracje (`npm run e2e`, `npm run e2e:malpa`).
  testIgnore: ['scenariusze/**', 'malpa.spec.js'],
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  globalSetup: require.resolve('./pomocnicze/start.js'),
  use: { baseURL: `http://127.0.0.1:${PORT}`, browserName: 'chromium' },
  webServer: {
    command: `node "${require.resolve('./pomocnicze/serwer-testowy.js')}"`,
    url: `http://127.0.0.1:${PORT}/test`,
    timeout: 120000,
    reuseExistingServer: false,
    env: { PSA_ZRZUTY_PORT: String(PORT) },
  },
});
