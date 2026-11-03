'use strict';

/**
 * `npm run zrzuty` → testy/e2e/zrzuty/<ekran>-<szerokość>.png (390 i 1440 px) + uklad.json
 * (wynik `sprawdzUklad` dla kart każdego ekranu). Zrzut nie przerywa się na problemach układu —
 * te sprawdzają testy zadań (`uklad-ekrany.spec.js`). Strona informacji z rejestru (druk A4) jako PNG.
 */

const fs = require('node:fs');
const path = require('node:path');
const { test } = require('@playwright/test');
const { sprawdzUklad } = require('./pomocnicze/uklad');
const { zaloguj, EKRANY } = require('./pomocnicze/ekrany');

const KATALOG = path.join(__dirname, 'zrzuty');
const wyniki = {};

test.beforeAll(() => fs.mkdirSync(KATALOG, { recursive: true }));
test.afterAll(() => fs.writeFileSync(path.join(KATALOG, 'uklad.json'), JSON.stringify(wyniki, null, 2)));

for (const ekran of EKRANY) {
  for (const szerokosc of [390, 1440]) {
    test(`${ekran.nazwa} ${szerokosc}px`, async ({ page }) => {
      await page.setViewportSize({ width: szerokosc, height: 900 });
      await zaloguj(page, ekran.konto, ekran.aplikacja);
      await page.goto(ekran.adres);
      await page.locator(ekran.czekaj).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(KATALOG, `${ekran.nazwa}-${szerokosc}.png`), fullPage: true });
      wyniki[`${ekran.nazwa}-${szerokosc}`] = await sprawdzUklad(page, '.karta');
    });
  }
}

test('informacja z rejestru — druk A4 (PNG)', async ({ page }) => {
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print' });
  await page.goto('/api/psa/spolki/1/informacja.html');
  await page.screenshot({ path: path.join(KATALOG, 'informacja-druk-a4.png'), fullPage: true });
  await page.pdf({ path: path.join(KATALOG, 'informacja.pdf'), format: 'A4' });
});
