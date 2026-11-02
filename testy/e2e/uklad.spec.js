'use strict';

/** Zadanie 0 — kontrola układu: zepsuta strona → problemy, poprawna → []. */

const { test, expect } = require('@playwright/test');
const { sprawdzUklad } = require('./pomocnicze/uklad');

const ZEPSUTA = `<!doctype html><html><body style="margin:0;font:16px sans-serif">
  <div class="karta" style="width:300px;padding:24px;border-radius:24px;border:1px solid #ccc">
    <div style="white-space:nowrap;overflow:hidden">Bardzo długa etykieta, która się nie mieści w kafelku i jest ucinana</div>
    <div style="margin-left:-20px">Tekst przy samej krawędzi</div>
  </div>
  <div style="width:2000px;height:10px"></div>
</body></html>`;

const POPRAWNA = `<!doctype html><html><body style="margin:0;font:16px sans-serif">
  <div class="karta" style="width:300px;padding:24px;border-radius:24px;border:1px solid #ccc">
    <div>Etykieta, która się zawija i mieści w kafelku bez ucinania</div>
    <div>Wartość</div>
  </div>
</body></html>`;

test('sprawdzUklad: zepsuta strona zwraca problemy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(ZEPSUTA);
  const problemy = await sprawdzUklad(page, '.karta');
  expect(problemy.length).toBeGreaterThanOrEqual(1);
  const rodzaje = problemy.map((p) => p.problem).join(' | ');
  expect(rodzaje).toMatch(/poziomy scroll/);
  expect(rodzaje).toMatch(/ucięty tekst/);
  expect(rodzaje).toMatch(/poza obszarem treści/);
});

test('sprawdzUklad: poprawna strona zwraca []', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(POPRAWNA);
  expect(await sprawdzUklad(page, '.karta')).toEqual([]);
});

test('sprawdzUklad: tekst przy krawędzi zaokrąglonej karty bez paddingu (karta ścisła)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(`<!doctype html><html><body style="margin:0;font:16px sans-serif">
    <div class="karta" style="width:300px;padding:0;border-radius:24px;border:1px solid #ccc">
      <div style="padding:16px 20px">Nagłówek z własnym marginesem</div>
      <div>Etykieta przy samej krawędzi</div>
    </div></body></html>`);
  const problemy = await sprawdzUklad(page, '.karta');
  expect(problemy.map((p) => p.selektor).join(' | ')).toMatch(/Etykieta przy samej krawędzi/);
  expect(problemy.map((p) => p.selektor).join(' | ')).not.toMatch(/Nagłówek/);
});

test('sprawdzUklad: tekst tylko dla czytnika ekranu (sr-only) nie jest problemem', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(`<!doctype html><html><body style="margin:0;font:16px sans-serif">
    <style>.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}</style>
    <div class="karta" style="width:300px;padding:24px;border-radius:24px;border:1px solid #ccc">
      <div>Wartość <span>znacznik<span class="sr-only">Bardzo długi opis tylko dla czytnika ekranu, który się nie mieści</span></span></div>
    </div></body></html>`);
  expect(await sprawdzUklad(page, '.karta')).toEqual([]);
});
