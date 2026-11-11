'use strict';

/**
 * Faza 4 — nowa spółka, każdy scenariusz przy 1440 i 390 px. Dane: `test:seed` + atrapa KRS (0000990004 — Delta).
 * 1) portal: zgłoszenie → link z e-maila → hasło → dane → dokumenty (umowa spółki w PDF, podpisy) →
 *    kancelaria: podpisy, podpis notariusza, checklista, „Przyjmij” → „Otwórz rejestr” → wpis otwarcia →
 *    portal: Start zamiast ekranów wniosku (Faza 5);
 * 2) wniosek założony przez pracownika z przejęciem — „Otwórz rejestr” dopiero od dnia przejęcia.
 */

const { test, expect, zaloguj } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');

const szer = (ti) => Number(ti.project.name);
const PDF = { name: 'dokument.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n') };
const dzis = () => new Date().toISOString().slice(0, 10);
const jutro = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

/** Wiersz dokumentu wniosku (portal i kancelaria). */
const dokument = (page, nazwa) => page.locator('.dokument-wniosku').filter({ hasText: nazwa });
async function wgraj(wiersz) {
  await wiersz.locator('input[type="file"]').first().setInputFiles(PDF);
  await wiersz.page().waitForLoadState('networkidle');
}

/** Formularz wniosku: reprezentant i dwóch akcjonariuszy (pierwszy — „to ja”). */
async function wypelnijDane(page, email) {
  const karta = (t) => page.locator('.karta').filter({ has: page.getByText(t, { exact: true }) });
  const r = karta('Kto podpisuje umowę za spółkę');
  await ui.wpisz(r, 'Imię i nazwisko', 'Barbara Zarządna');
  await ui.wpisz(r, 'PESEL', '44051401359');
  await ui.wpisz(r, 'Adres', 'ul. Zarządowa 1, 80-001 Gdańsk');
  if (email) await ui.wpisz(r, 'E-mail', email);
  const a = karta('Akcjonariusze');
  await a.getByRole('button', { name: '+ Dodaj akcjonariusza' }).click();
  await a.getByRole('button', { name: '+ Dodaj akcjonariusza' }).click();
  const pierwszy = a.locator('.element-listy').nth(0);
  await ui.wpisz(pierwszy, 'Imię i nazwisko', 'Barbara Zarządna');
  await ui.wpisz(pierwszy, 'PESEL', '44051401359');
  await ui.wpisz(pierwszy, 'Adres', 'ul. Zarządowa 1, 80-001 Gdańsk');
  await ui.wpisz(pierwszy, 'E-mail', email || 'barbara@example.com');
  await pierwszy.getByText('To ja').click();
  const drugi = a.locator('.element-listy').nth(1);
  await ui.wpisz(drugi, 'Imię i nazwisko', 'Cezary Wspólnik');
  await ui.wpiszDate(drugi, 'Data urodzenia', '1980-03-03');
  await ui.wpisz(drugi, 'Adres', 'ul. Wspólna 2, 80-002 Gdańsk');
  await ui.wpisz(drugi, 'E-mail', 'cezary@example.com');
}

test('portal: zgłoszenie → dokumenty → podpisy; kancelaria: przyjęcie → otwarcie rejestru', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'nowa-spolka', proces: 'Wniosek: zgłoszenie → otwarcie', szerokosc: szer(testInfo), persona: 'zarząd spółki → notariusz' });
  await krok(page, 'Portal — zgłoś spółkę', async () => {
    await page.goto('/portal.html#/zglos');
    await ui.wpisz(page, 'Numer KRS spółki', '0000990004');
    await ui.wpisz(page, 'Twój e-mail', 'beta.zarzad@example.com');
    await ui.przycisk(page, 'Wyślij');
    await ui.gotowe(page, 'Sprawdź skrzynkę e-mail');
  });
  await krok(page, 'Link z e-maila — ustaw hasło', async () => {
    await page.goto('/test/skrzynka');
    await page.getByRole('link', { name: /dokończ zgłoszenie/ }).first().click();
    const link = (await page.content()).match(/portal\.html#\/aktywacja\?token=[0-9a-f]+/)[0];
    await page.goto(`/${link}`);
    await page.locator('.pole-haslo input').fill('Mocne-Haslo-2026!');
    await page.getByRole('checkbox').check();
    await ui.przycisk(page, 'Zapisz');
    await ui.gotowe(page, 'krok 1 z 2');
  });
  await krok(page, 'Nowa spółka 1/2 — dane', async () => {
    await expect(ui.pole(page, 'Firma').locator('input')).toHaveValue(/DELTA/);
    await wypelnijDane(page, null);
    await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'krok 2 z 2');
  });
  await krok(page, 'Nowa spółka 2/2 — umowa spółki, podpisane dokumenty, uchwała w umowie', async () => {
    await wgraj(dokument(page, 'Umowa spółki'));
    await wgraj(dokument(page, 'Umowa o prowadzenie'));
    await wgraj(dokument(page, 'Cezary Wspólnik'));
    await dokument(page, 'Uchwała').getByRole('button', { name: 'Inna uchwała?' }).click();
    await ui.przycisk(page, 'Wybór jest w umowie spółki');
    await expect(dokument(page, 'Uchwała')).toHaveCount(0);
    await expect(dokument(page, 'Umowa o prowadzenie').getByText('sprawdzamy')).toBeVisible();
  });
  await krok(page, 'Kancelaria — wniosek z Pulpitu', async () => {
    await page.context().clearCookies();
    await zaloguj(page, 'notariusz@example.com', 'kancelaria');
    await page.goto('/#/');
    await page.getByRole('link', { name: /Wniosek KRS 0000990004/ }).click();
    await ui.gotowe(page, 'Przed przyjęciem');
  });
  await krok(page, 'Podpisy, podpis notariusza, checklista', async () => {
    for (const nazwa of ['Umowa o prowadzenie', 'Cezary Wspólnik']) {
      await dokument(page, nazwa).getByRole('button', { name: 'Potwierdź podpis' }).click();
      await expect(dokument(page, nazwa).getByText('podpisany')).toBeVisible();
    }
    await dokument(page, 'Umowa o prowadzenie').locator('.podsekcja input[type="file"]').setInputFiles(PDF);
    await dokument(page, 'Umowa o prowadzenie').getByText('Umowa z podpisem notariusza').waitFor();
    const lista = page.locator('.karta').filter({ has: page.getByText('Checklista', { exact: true }) }).locator('input[type="checkbox"]');
    for (let i = 0; i < await lista.count(); i += 1) {
      await lista.nth(i).check();
      await page.waitForLoadState('networkidle');
    }
    await expect(page.getByRole('button', { name: 'Przyjmij' })).toBeEnabled({ timeout: 10000 });
  });
  await krok(page, 'Przyjmij → Otwórz rejestr', async () => {
    await ui.przycisk(page, 'Przyjmij');
    await ui.przycisk(page, 'Otwórz rejestr');
    await ui.gotowe(page, '1. Otwarcie rejestru');
  });
  await krok(page, 'Sprawa otwarcia — numery akcji, wpis', async () => {
    const numery = page.getByLabel('Numery', { exact: true });
    const liczby = page.getByLabel('Liczba', { exact: true });
    await numery.nth(0).fill('1-100'); await liczby.nth(0).fill('100');
    await numery.nth(1).fill('1-70'); await liczby.nth(1).fill('70');
    await numery.nth(2).fill('71-100'); await liczby.nth(2).fill('30');
    await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Dalej', exact: true })).toBeEnabled({ timeout: 10000 });
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Checklista');
    await ui.checklista(page);
    await ui.przycisk(page, 'Dokonaj wpisu');
    await page.getByRole('dialog').getByRole('button', { name: 'Dokonaj wpisu' }).click();
    await page.getByText('Wpisana').first().waitFor();
  });
  await krok(page, 'Kokpit — rejestr otwarty', async () => {
    await page.getByRole('link', { name: /DELTA/ }).first().click();
    await ui.gotowe(page, 'rejestr otwarty');
    await page.getByRole('link', { name: 'Cezary Wspólnik' }).first().waitFor();
  });
  await krok(page, 'Portal po przyjęciu — Start zamiast ekranów wniosku', async () => {
    await page.context().clearCookies();
    expect((await page.request.post('/api/psa/portal/login', { data: { email: 'beta.zarzad@example.com', haslo: 'Mocne-Haslo-2026!' } })).ok()).toBeTruthy();
    await page.goto('/portal.html#/');
    await ui.gotowe(page, 'KRS 0000990004');
    await expect(page.getByText('krok 2 z 2')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Menu portalu' }).getByRole('link')).toHaveText(['Start', 'Konto']);
  });
  await zakoncz(page);
});

test('kancelaria: nowa spółka z przejęciem — „Otwórz rejestr” dopiero od dnia przejęcia', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'przejecie', proces: 'Wniosek pracownika: przejęcie rejestru', szerokosc: szer(testInfo), persona: 'notariusz' });
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  await krok(page, 'Spółki — Nowa spółka', async () => {
    await page.goto('/#/spolki');
    await ui.przycisk(page, 'Nowa spółka');
    await ui.wpisz(page, 'Numer KRS', '0000990004');
    await page.getByText('Przejęcie rejestru od innego podmiotu').click();
    await ui.przycisk(page, 'Załóż wniosek');
    await ui.gotowe(page, 'Przeniesienie rejestru od innej firmy');
  });
  await krok(page, 'Dane wniosku i przejęcie', async () => {
    await wypelnijDane(page, 'rep@example.com');
    await ui.wpisz(page, 'Kto dotąd prowadził rejestr', 'Dom Maklerski Testowy S.A.');
    await ui.wpiszDate(page, 'Od kiedy mamy prowadzić rejestr', jutro());
    await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Złóż — przygotuj dokumenty' })).toBeEnabled({ timeout: 10000 });
    await ui.przycisk(page, 'Złóż — przygotuj dokumenty');
    await ui.gotowe(page, 'Przed przyjęciem');
  });
  await krok(page, 'Dokumenty z poczty, podpisy, notariusz, checklista', async () => {
    await wgraj(dokument(page, 'Umowa spółki'));
    for (const nazwa of ['Umowa o prowadzenie', 'Uchwała']) {
      await wgraj(dokument(page, nazwa));
      await dokument(page, nazwa).getByRole('button', { name: 'Potwierdź podpis' }).click();
      await expect(dokument(page, nazwa).getByText('podpisany')).toBeVisible();
    }
    await dokument(page, 'Umowa o prowadzenie').locator('.podsekcja input[type="file"]').setInputFiles(PDF);
    await dokument(page, 'Umowa o prowadzenie').getByText('Umowa z podpisem notariusza').waitFor();
    const lista = page.locator('.karta').filter({ has: page.getByText('Checklista', { exact: true }) }).locator('input[type="checkbox"]');
    for (let i = 0; i < await lista.count(); i += 1) {
      await lista.nth(i).check();
      await page.waitForLoadState('networkidle');
    }
  });
  await krok(page, 'Przyjmij', async () => {
    await expect(page.getByRole('button', { name: 'Przyjmij' })).toBeEnabled({ timeout: 10000 });
    await ui.przycisk(page, 'Przyjmij');
    await page.getByText('Przyjęty').first().waitFor();
  });
  await krok(page, 'Otwórz rejestr — dopiero od dnia przejęcia', async () => {
    await expect(page.getByRole('button', { name: 'Otwórz rejestr' })).toBeDisabled();
    await page.getByText(/Dostępne od/).first().waitFor();
    await ui.wpiszDate(page, 'Data przejęcia', dzis());
    await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Otwórz rejestr' })).toBeEnabled({ timeout: 10000 });
    await ui.przycisk(page, 'Otwórz rejestr');
    await ui.gotowe(page, '1. Otwarcie rejestru');
    await expect(ui.pole(page, 'Źródło').locator('select')).toHaveValue('przejecie');
  });
  await zakoncz(page);
});
