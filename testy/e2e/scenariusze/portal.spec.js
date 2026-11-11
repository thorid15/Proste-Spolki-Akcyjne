'use strict';

/**
 * Faza 5 — portal klienta (§ 6, U-23), każdy scenariusz przy 1440 i 390 px. Dane: `test:seed`.
 * 1) osoba działająca za spółkę (zarząd Alfy): Start, Zgłoś zmianę z plikiem, informacja z wyborem dnia (U-24)
 *    i płatność jednym przyciskiem z kwotą (atrapa kasy tpay → ITN); kancelaria widzi zgłoszenie na Pulpicie;
 * 2) akcjonariuszka (Anna): tylko swoje sprawy i opłaty, zgoda w Koncie; po „Dodaj” w kokpicie — obie role
 *    (widzi sprawy spółki), po „Usuń” — z powrotem tylko akcjonariuszka.
 */

const { test, expect, zaloguj } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');

const szer = (ti) => Number(ti.project.name);
const PDF = { name: 'umowa-sprzedazy.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n') };
const zaDni = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test('portal: osoba działająca za spółkę — zgłoszenie zmiany, informacja z rejestru z płatnością; Pulpit kancelarii', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-zarzad', proces: 'Portal: Start, zgłoszenie, informacja', szerokosc: szer(testInfo), persona: 'zarząd spółki' });
  // Informacja w portalu — najpóźniej za wczoraj; rejestr Alfy otwarto dziś (seed), więc data rejestru +2 dni.
  await page.request.post('/test/data', { form: { data: zaDni(2) } });
  await zaloguj(page, 'alfa.zarzad@example.com', 'portal');
  await krok(page, 'Start — firma, zakładki Start · Sprawy · Płatności · Informacja · Pomoc · Konto', async () => {
    await page.goto('/portal.html#/');
    await ui.gotowe(page, 'Alfa Testowa P.S.A.');
    await expect(page.getByRole('navigation', { name: 'Menu portalu' }).getByRole('link')).toHaveText(['Start', 'Sprawy', 'Płatności', 'Informacja', 'Pomoc', 'Konto']);
  });
  await krok(page, 'Zgłoś zmianę — opis i plik', async () => {
    await ui.przycisk(page, 'Zgłoś zmianę');
    await ui.wpisz(page, 'Co się zmieniło?', 'Akcjonariusz sprzedał 50 akcji serii A — umowa w załączniku.');
    await ui.pole(page, 'Pliki').locator('input[type="file"]').setInputFiles(PDF);
    await ui.przycisk(page, 'Wyślij');
    await ui.gotowe(page, 'Zgłoszenie wysłane');
    await page.locator('.karta').getByRole('link', { name: 'Sprawy' }).click();
    await page.getByText('Akcjonariusz sprzedał 50 akcji').waitFor();
    await expect(page.locator('.wiersz-portalu').filter({ hasText: 'Akcjonariusz sprzedał' }).getByText('W toku')).toBeVisible();
  });
  await krok(page, 'Zakładka Informacja — dzień (domyślnie wczoraj), „Zapłać 61,50 zł”', async () => {
    await page.getByRole('navigation', { name: 'Menu portalu' }).getByRole('link', { name: 'Informacja' }).click();
    await expect(ui.pole(page, 'Stan na koniec dnia').locator('.pole-daty-wejscie')).toHaveValue(zaDni(1).split('-').reverse().join('.'));
    await page.getByRole('button', { name: /Zapłać 61,50/ }).click();
    await page.getByText('Atrapa kasy tpay').waitFor({ timeout: 15000 });
  });
  await krok(page, 'Kasa — zapłata, powrót do portalu, informacja do pobrania', async () => {
    await page.getByRole('button', { name: 'Zapłać (wyślij ITN)' }).click();
    await ui.gotowe(page, 'Płatność przyjęta');
    await expect(page.locator('.karta').filter({ hasText: 'Wydane informacje' }).getByRole('link', { name: /Stan na/ })).toBeVisible();
  });
  await krok(page, 'Kancelaria — nowe zgłoszenie z portalu na Pulpicie', async () => {
    await page.context().clearCookies();
    await zaloguj(page, 'notariusz@example.com', 'kancelaria');
    await page.goto('/#/');
    await ui.gotowe(page, 'nowe zgłoszenie z portalu');
  });
  await zakoncz(page);
});

test('portal: akcjonariuszka — tylko swoje; Konto; obie role po „Dodaj” w kokpicie, z powrotem po „Usuń”', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-akcjonariusz', proces: 'Portal: zakres konta (U-23)', szerokosc: szer(testInfo), persona: 'akcjonariuszka → notariusz' });
  await zaloguj(page, 'anna.zgoda@example.com', 'portal');
  await krok(page, 'Akcjonariuszka — Start, Płatności (kwota na przycisku), Sprawy bez spraw spółki, Pomoc', async () => {
    await page.goto('/portal.html#/');
    await ui.gotowe(page, 'Do zapłaty: 1');
    await page.getByRole('link', { name: 'Do zapłaty: 1' }).click();
    await expect(page.getByRole('button', { name: /Zapłać 61,50/ })).toBeVisible();
    await page.getByRole('navigation', { name: 'Menu portalu' }).getByRole('link', { name: 'Sprawy' }).click();
    await expect(page.getByText('Brak spraw.')).toBeVisible();
    await page.getByRole('navigation', { name: 'Menu portalu' }).getByRole('link', { name: 'Pomoc' }).click();
    await ui.gotowe(page, 'Kontakt z kancelarią');
  });
  await krok(page, 'Konto — zgoda na korespondencję e-mail', async () => {
    await page.getByRole('link', { name: 'Konto' }).click();
    await ui.gotowe(page, 'Zgoda na korespondencję e-mail');
    await expect(page.getByText('anna.zgoda@example.com')).toBeVisible();
  });
  await krok(page, 'Kancelaria — „Działają za spółkę” → Dodaj Annę', async () => {
    await zaloguj(page, 'notariusz@example.com', 'kancelaria');
    await page.goto('/#/spolki/1');
    const karta = page.locator('.karta').filter({ has: page.getByText('Działają za spółkę', { exact: true }) });
    await karta.getByRole('button', { name: 'Dodaj' }).click();
    await ui.wybierzZKartoteki(karta, 'Osoba z kartoteki albo nowa', 'Anna');
    await expect(karta.getByRole('link', { name: 'Anna Testowa' })).toBeVisible();
  });
  await krok(page, 'Portal — obie role: sprawy spółki widoczne', async () => {
    await page.goto('/portal.html#/sprawy');
    await ui.gotowe(page, 'Alfa Testowa P.S.A.');
    await expect(page.getByText(/Sprawa nr \d+/).first()).toBeVisible();
  });
  await krok(page, 'Kancelaria — Usuń; portal — znów tylko akcjonariuszka', async () => {
    await page.goto('/#/spolki/1');
    const wiersz = page.locator('.karta').filter({ has: page.getByText('Działają za spółkę', { exact: true }) }).locator('.rzad-rozdzielony').filter({ hasText: 'Anna Testowa' });
    await wiersz.getByRole('button', { name: 'Usuń' }).click();
    await expect(wiersz).toHaveCount(0);
    await page.goto('/portal.html#/sprawy');
    await ui.gotowe(page, 'Alfa Testowa P.S.A.');
    await expect(page.getByText('Brak spraw.')).toBeVisible();
  });
  await zakoncz(page);
});
