'use strict';

/** Testy układu ekranów z SESJA-PSA-POPRAWKI-R4 (faza 1): `sprawdzUklad` → []. */

const { test, expect } = require('@playwright/test');
const { sprawdzUklad } = require('./pomocnicze/uklad');
const { zaloguj } = require('./pomocnicze/ekrany');

async function otworz(page, { konto, aplikacja, adres, czekaj, szerokosc }) {
  await page.setViewportSize({ width: szerokosc, height: 900 });
  await zaloguj(page, konto, aplikacja);
  await page.goto(adres);
  await page.locator(czekaj).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
}

test('P1: karta „Dane spółki” przy 390 px bez problemów układu', async ({ page }) => {
  await otworz(page, { konto: 'zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/spolka/1', czekaj: 'text=Dane spółki', szerokosc: 390 });
  const karta = page.locator('.karta', { hasText: 'Dane spółki' });
  await karta.evaluate((el) => el.setAttribute('data-test', 'dane-spolki'));
  expect(await sprawdzUklad(page, '[data-test="dane-spolki"]')).toEqual([]);
});
