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

test('P5: „Stan na dzień” — pole tylko na datę, kalendarz obok, układ bez problemów', async ({ page }) => {
  await otworz(page, { konto: 'zarzad@example.com', aplikacja: 'portal', adres: '/portal.html#/informacja/1', czekaj: 'text=Stan na dzień', szerokosc: 1440 });
  const segmenty = page.locator('.data-segmenty').first();
  const kalendarz = page.locator('.pole-daty .kalendarz-kotwica button').first();
  const [s, k] = [await segmenty.boundingBox(), await kalendarz.boundingBox()];
  // Szerokość pola daty = sama data (DD.MM.RRRR + marginesy), nie cała kolumna — wzorzec ≤ 12rem.
  expect(s.width).toBeLessThanOrEqual(192);
  expect(k.x - (s.x + s.width)).toBeLessThan(24);
  expect(Math.abs((k.y + k.height / 2) - (s.y + s.height / 2))).toBeLessThan(4);
  const karta = page.locator('.karta', { has: segmenty });
  await karta.evaluate((el) => el.setAttribute('data-test', 'zamowienie'));
  expect(await sprawdzUklad(page, '[data-test="zamowienie"]')).toEqual([]);
});

test('K4: informacja z 3 seriami i długim zakresem — PDF bez wyjątku, emisje w marginesach A4', async ({ page }) => {
  const { informacjaZTrzemaSeriami } = require('./pomocnicze/informacja-dluga');
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print' });
  await page.setContent(informacjaZTrzemaSeriami());
  const pdf = await page.pdf({ format: 'A4' });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  const problemy = (await sprawdzUklad(page, '.arkusz')).filter((p) => /seria|Numery|000001/.test(p.selektor) || p.selektor === 'document');
  expect(problemy).toEqual([]);
  await page.screenshot({ path: require('node:path').join(__dirname, 'zrzuty', 'informacja-dluga-a4.png'), fullPage: true });
});

for (const szerokosc of [1440, 390]) {
  test(`K1: sprawa przeniesienia ${szerokosc} px — jedna kolumna, jeden pasek akcji, układ bez problemów`, async ({ page }) => {
    await otworz(page, { konto: 'notariusz@example.com', aplikacja: 'kancelaria', adres: '/#/sprawy/1', czekaj: 'text=Uprzednie powiadomienie', szerokosc });
    const kolumna = page.locator('.kolumna-sprawy');
    await expect(kolumna).toHaveCount(1);
    const szerokosci = await kolumna.evaluate((k) => [...k.children].filter((e) => e.offsetWidth > 0).map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(new Set(szerokosci).size).toBe(1);
    if (szerokosc === 1440) expect(szerokosci[0]).toBeLessThanOrEqual(768);
    const pasek = page.locator('.pasek-akcji');
    await expect(pasek).toHaveCount(1);
    for (const nazwa of ['Popraw podstawę wpisu', 'Wystaw żądanie wpisu']) await expect(pasek.getByRole('button', { name: nazwa })).toBeVisible();
    await expect(page.locator('.btn-tekstowy', { hasText: 'podstawę wpisu' })).toHaveCount(0);
    await expect(page.locator('#panel-powiadomienia label.chk input[type="checkbox"]')).toHaveCount(1);
    expect(await sprawdzUklad(page, '.kolumna-sprawy .karta')).toEqual([]);
    const tekst = await page.locator('.kolumna-sprawy').innerText();
    expect(tekst).not.toMatch(/[0-9a-f]{4,8}(-[0-9a-f]{4}){1,3}-[0-9a-f]{12}/i);
  });
}

test('K5: kreator przeniesienia — zbywca bez zgody na e-mail ma znacznik „list”', async ({ page }) => {
  await otworz(page, { konto: 'notariusz@example.com', aplikacja: 'kancelaria', adres: '/#/sprawy/1', czekaj: 'text=Co się zmienia', szerokosc: 1440 });
  const seria = page.locator('select', { has: page.locator('option', { hasText: 'wybierz serię' }) });
  await seria.selectOption({ index: 1 });
  const zbywca = page.locator('select', { has: page.locator('option', { hasText: 'wybierz akcjonariusza' }) });
  await zbywca.selectOption(await zbywca.locator('option', { hasText: 'Próbny' }).getAttribute('value'));
  await expect(page.getByText('Brak zgody — konieczne powiadomienie listem').first()).toBeVisible();
  // Zbywca ze zgodą (Anna) — bez znacznika przy polu zbywcy.
  await zbywca.selectOption(await zbywca.locator('option', { hasText: 'Testowa Anna' }).getAttribute('value'));
  await expect(page.locator('.pole-zbywcy .znacznik-kontaktu')).toHaveCount(0);
});

test('P7: „Moje oświadczenia” — powiadomienia: odznacz i zaznacz ponownie; checkbox zgody dostępny', async ({ page }) => {
  await otworz(page, { konto: 'anna.zgoda@example.com', aplikacja: 'portal', adres: '/portal.html#/konto', czekaj: 'text=Moje oświadczenia', szerokosc: 1440 });
  const pow = page.getByRole('checkbox', { name: /automatycznych powiadomień/ });
  await expect(pow).toBeChecked();
  // Pole kontrolowane — stan zmienia się po zapisie w API (dlatego klik + oczekiwanie, nie uncheck()).
  await pow.click();
  await expect(pow).not.toBeChecked();
  await pow.click();
  await expect(pow).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Wyrażam zgodę na komunikację/ })).toBeEnabled();
});

test('P8: cofnięcie zgody na e-mail — ostrzeżenie; „Zostaw zgodę” i Esc bez żądania, „Cofam zgodę” jedno żądanie', async ({ page }) => {
  await otworz(page, { konto: 'anna.zgoda@example.com', aplikacja: 'portal', adres: '/portal.html#/konto', czekaj: 'text=Moje oświadczenia', szerokosc: 390 });
  const zadania = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/psa/portal/oswiadczenia')) zadania.push(r.postDataJSON()); });
  const zgoda = page.getByRole('checkbox', { name: /Wyrażam zgodę na komunikację/ });
  await expect(zgoda).toBeChecked();

  await zgoda.click();
  const okno = page.getByRole('dialog', { name: 'Cofnąć zgodę na e-mail?' });
  await expect(okno).toBeVisible();
  await expect(okno).toContainText('Bez zgody na e-mail postępowanie potrwa dłużej: powiadomienie o zamiarze wpisu i zawiadomienie o dokonanym wpisie wyślemy listem, a dostęp do portalu wygaśnie.');
  await expect(okno.getByRole('button', { name: 'Zostaw zgodę' })).toBeFocused();
  await okno.getByRole('button', { name: 'Zostaw zgodę' }).click();
  await expect(okno).toHaveCount(0);
  await zgoda.click();
  await page.keyboard.press('Escape');
  await expect(okno).toHaveCount(0);
  expect(zadania).toHaveLength(0);
  await expect(zgoda).toBeChecked();

  await zgoda.click();
  await okno.getByRole('button', { name: 'Cofam zgodę' }).click();
  await expect(zgoda).not.toBeChecked();
  expect(zadania).toHaveLength(1);
  expect(zadania[0]).toMatchObject({ rodzaj: 'zgoda_email', zlozone: false });
  await zgoda.click(); // P7: ponowne złożenie w tej samej sesji
  await expect(zgoda).toBeChecked();
});
