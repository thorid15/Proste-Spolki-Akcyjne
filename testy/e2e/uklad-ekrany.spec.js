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

const TEKST_P4 = 'Stan akcjonariatu (akcjonariusze, akcje, obciążenia) jest dostępny w pełnej informacji z rejestru akcjonariuszy.';

test('P3/P4: komunikat i dwa przyciski w jednym rzędzie (1440 px)', async ({ page }) => {
  await otworz(page, { konto: 'zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/spolka/1', czekaj: 'text=Dane spółki', szerokosc: 1440 });
  await expect(page.getByText(TEKST_P4, { exact: true })).toBeVisible();
  const zamow = page.getByRole('button', { name: 'Zamów informację z rejestru' });
  const blad = page.getByRole('button', { name: 'Zgłoś błąd we wpisie' });
  await expect(blad).toBeVisible();
  const [a, b] = [await zamow.boundingBox(), await blad.boundingBox()];
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  const karta = page.locator('.karta', { has: zamow });
  await expect(karta.getByRole('button', { name: 'Zgłoś błąd we wpisie' })).toHaveCount(1);
});

test('P3: na 390 px oba przyciski na pełną szerokość, główny wyżej; układ bez problemów', async ({ page }) => {
  await otworz(page, { konto: 'zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/spolka/1', czekaj: 'text=Dane spółki', szerokosc: 390 });
  const zamow = page.getByRole('button', { name: 'Zamów informację z rejestru' });
  const blad = page.getByRole('button', { name: 'Zgłoś błąd we wpisie' });
  const [a, b] = [await zamow.boundingBox(), await blad.boundingBox()];
  expect(a.y).toBeLessThan(b.y);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  const karta = page.locator('.karta', { has: zamow });
  await karta.evaluate((el) => el.setAttribute('data-test', 'informacja'));
  expect(await sprawdzUklad(page, '[data-test="informacja"]')).toEqual([]);
});
