'use strict';

/**
 * Wpis zbycia akcji (K5, D-091) — persony z `test:seed`: Alfa Testowa P.S.A., Anna Testowa (zgoda e-mail, 600 akcji),
 * Bartosz Próbny (bez zgody, 400 akcji), Celina Nabywczyni (bez akcji).
 */

const { test, expect, zaloguj } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');

const DZIS = new Date().toISOString().slice(0, 10);

async function doKreatora(page, testInfo, scenariusz, persona) {
  rozpocznij(page, testInfo, { scenariusz, proces: 'K5 wpis zbycia', szerokosc: Number(testInfo.project.name), persona });
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  await krok(page, 'Kokpit spółki', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Alfa Testowa');
  });
  await krok(page, 'Przeniesienie akcji (kokpit)', async () => {
    await page.getByRole('button', { name: 'Przeniesienie akcji' }).first().click();
    await ui.gotowe(page, 'Co się zbywa');
  });
}

async function coSieZbywa(page, { zbywca, ilosc, nabywca }) {
  await krok(page, 'Co się zbywa', async () => {
    await ui.wybierz(page, 'Zbywca', zbywca);
    await ui.wpisz(page, 'Liczba zbywanych akcji', ilosc);
    if (nabywca) await ui.wybierzZKartoteki(page, 'Nabywca', nabywca);
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Data umowy zbycia');
  });
}

async function podstawa(page) {
  await krok(page, 'Podstawa', async () => {
    await ui.wpiszDate(page, 'Data umowy zbycia', DZIS);
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Dokonaj wpisu');
  });
}

async function checklista(page) {
  const pola = page.locator('.karta input[type="checkbox"]:visible');
  const n = await pola.count();
  for (let i = 0; i < n; i += 1) {
    const p = pola.nth(i);
    const etykieta = await p.evaluate((el) => (el.closest('label') || el.parentElement).textContent);
    if (/wątpliwości/i.test(etykieta)) continue;
    if (!(await p.isChecked())) await p.check();
  }
}

test('zbycie: zbywca bez zgody na e-mail — powiadomienie listem, nadanie, wpis', async ({ page }, testInfo) => {
  await doKreatora(page, testInfo, 'zbycie-bez-zgody', 'Bartosz Próbny → Celina Nabywczyni');
  await coSieZbywa(page, { zbywca: 'Próbny', ilosc: 100, nabywca: 'Nabywczyni' });
  await podstawa(page);
  await krok(page, 'Sprawdzenie i wpis — powiadomienie', async () => {
    await page.getByRole('button', { name: 'Wyślij powiadomienie' }).first().click();
    await ui.gotowe(page);
  });
  const adresSprawy = page.url();
  await krok(page, 'Kolejka listów — nadanie', async () => {
    await page.goto('/#/listy');
    await ui.gotowe(page, 'Listy');
    const wiersz = page.locator('.karta, tr').filter({ hasText: 'Próbny' }).last();
    await wiersz.getByRole('button', { name: 'Nadano' }).first().click();
    await ui.wpiszDate(page, 'Data nadania', DZIS);
    await ui.wpisz(page, 'Numer nadania', 'RR123456789PL');
    await page.getByRole('button', { name: 'Zapisz nadanie' }).first().click();
    await ui.gotowe(page);
  });
  await krok(page, 'Powrót do sprawy — wpis', async () => {
    await page.goto(adresSprawy);
    await ui.gotowe(page, 'Dokonaj wpisu');
    await checklista(page);
    await ui.przycisk(page, 'Dokonaj wpisu');
    await ui.gotowe(page, 'wpis dokonany');
  });
  await zakoncz(page);
});

test('zbycie: zbywca ze zgodą e-mail — wpis bez kolejki listów', async ({ page }, testInfo) => {
  await doKreatora(page, testInfo, 'zbycie-ze-zgoda', 'Anna Testowa → Celina Nabywczyni');
  await coSieZbywa(page, { zbywca: 'Testowa', ilosc: 50, nabywca: 'Nabywczyni' });
  await podstawa(page);
  await krok(page, 'Sprawdzenie i wpis', async () => {
    await page.getByRole('button', { name: 'Wyślij powiadomienie' }).first().click();
    await ui.gotowe(page);
    await checklista(page);
    await ui.przycisk(page, 'Dokonaj wpisu');
    await ui.gotowe(page, 'wpis dokonany');
  });
  await zakoncz(page);
});
