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

// Karta formularza o danym tytule — najgłębsza (strona nowego rejestru ma karty formularza wewnątrz sekcji).
const karta = (page, t) => page.locator('.karta').filter({ has: page.getByText(t, { exact: true }) }).last();
const krokWniosku = (page, nazwa) => page.locator('.kroki').getByRole('button', { name: new RegExp(nazwa) }).click();
const sekcja = (page, tytul) => page.locator('.sekcja-wpisu').filter({ has: page.getByRole('heading', { name: tytul }) });

/** Nowy rejestr w kancelarii (D-233): serie i pakiety wpisuje pracownik, potem jedna checklista. */
async function wpiszAkcjeISprawdz(page) {
  const akcje = sekcja(page, /Akcje i akcjonariusze/);
  const numery = akcje.getByLabel('Numery', { exact: true });
  const liczby = akcje.getByLabel('Liczba', { exact: true });
  await numery.nth(0).fill('1-100'); await liczby.nth(0).fill('100');
  await numery.nth(1).fill('1-70'); await liczby.nth(1).fill('70');
  await numery.nth(2).fill('71-100'); await liczby.nth(2).fill('30');
  await akcje.getByText('rozdzielono 100 z 100').waitFor();
  await ui.checklista(page);
  await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
}

/** Formularz wniosku: osoba podpisująca umowę. */
async function wypelnijReprezentanta(page, email) {
  const r = karta(page, 'Kto podpisuje umowę za spółkę');
  await ui.wpisz(r, 'Imię i nazwisko', 'Barbara Zarządna');
  await ui.wpisz(r, 'PESEL', '44051401359');
  await ui.wpisz(r, 'Adres', 'ul. Zarządowa 1, 80-001 Gdańsk');
  if (email) await ui.wpisz(r, 'E-mail', email);
}

/** Formularz wniosku: dwóch akcjonariuszy (pierwszy — „to ja”). */
async function wypelnijAkcjonariuszy(page, email) {
  const a = karta(page, 'Akcjonariusze');
  await a.getByRole('button', { name: '+ Dodaj akcjonariusza' }).click();
  await a.getByRole('button', { name: '+ Dodaj akcjonariusza' }).click();
  const pierwszy = a.locator('.element-listy').nth(0);
  await ui.wpisz(pierwszy, 'Imię i nazwisko', 'Barbara Zarządna');
  await ui.wpisz(pierwszy, 'PESEL', '44051401359');
  await ui.wpisz(pierwszy, 'Adres', 'ul. Zarządowa 1, 80-001 Gdańsk');
  await ui.wpisz(pierwszy, 'E-mail', email || 'barbara@example.com');
  await pierwszy.getByText(/To ja|To osoba podpisująca/).click();
  const drugi = a.locator('.element-listy').nth(1);
  await ui.wpisz(drugi, 'Imię i nazwisko', 'Cezary Wspólnik');
  await ui.wpiszDate(drugi, 'Data urodzenia', '1980-03-03');
  await ui.wpisz(drugi, 'Adres', 'ul. Wspólna 2, 80-002 Gdańsk');
  await ui.wpisz(drugi, 'E-mail', 'cezary@example.com');
}

test('portal: zgłoszenie → dokumenty → podpisy; kancelaria: jedna strona → „Otwórz rejestr”', async ({ page }, testInfo) => {
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
    await ui.gotowe(page, 'Nowa spółka');
  });
  await krok(page, 'Nowa spółka — Spółka → Reprezentant → Akcjonariusze → Podsumowanie', async () => {
    await expect(ui.pole(page, 'Firma').locator('input')).toHaveValue(/DELTA/);
    await ui.przycisk(page, 'Dalej');
    await wypelnijReprezentanta(page, null);
    await ui.przycisk(page, 'Dalej');
    await wypelnijAkcjonariuszy(page, null);
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Co dalej po złożeniu wniosku');
    await expect(karta(page, 'Akcjonariusze (2)').getByText('Cezary Wspólnik')).toBeVisible();
    await ui.przycisk(page, 'Złóż wniosek');
    await ui.gotowe(page, 'dokumenty do podpisu');
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
    await ui.gotowe(page, 'Pobierz dokument');
  });
  await krok(page, 'Jedna strona: spółka, akcjonariusze z wniosku, dokumenty, otwarcie', async () => {
    for (const tytul of [/Spółka/, /Akcje i akcjonariusze/, /Dokumenty/, /Otwarcie rejestru/]) await sekcja(page, tytul).first().waitFor();
    await expect(sekcja(page, /Akcje i akcjonariusze/).locator('.zmiana')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Otwórz rejestr' })).toBeDisabled();
  });
  await krok(page, 'Podpisy, podpis notariusza', async () => {
    for (const nazwa of ['Umowa o prowadzenie', 'Cezary Wspólnik']) {
      await dokument(page, nazwa).getByRole('button', { name: 'Potwierdź podpis' }).click();
      await expect(dokument(page, nazwa).getByText('podpisany')).toBeVisible();
    }
    await dokument(page, 'Umowa o prowadzenie').locator('.podsekcja input[type="file"]').setInputFiles(PDF);
    await dokument(page, 'Umowa o prowadzenie').getByText('Umowa z podpisem notariusza').waitFor();
  });
  await krok(page, 'Numery akcji, sprawdzone — „Otwórz rejestr” przyjmuje wniosek i dokonuje wpisu otwarcia', async () => {
    await wpiszAkcjeISprawdz(page);
    await expect(page.getByRole('button', { name: 'Otwórz rejestr' })).toBeEnabled({ timeout: 10000 });
    await ui.przycisk(page, 'Otwórz rejestr');
    await page.waitForURL(/#\/spolki\/\d+/);
    await ui.gotowe(page, 'rejestr otwarty');
    await page.getByRole('link', { name: 'Cezary Wspólnik' }).first().waitFor();
    await page.locator('.historia-wpisow').getByText('Otwarcie rejestru akcjonariuszy: seria A nr 1–100').waitFor();
  });
  await krok(page, 'Portal po przyjęciu — Start zamiast ekranów wniosku', async () => {
    await page.context().clearCookies();
    expect((await page.request.post('/api/psa/portal/login', { data: { email: 'beta.zarzad@example.com', haslo: 'Mocne-Haslo-2026!' } })).ok()).toBeTruthy();
    await page.goto('/portal.html#/');
    await ui.gotowe(page, 'KRS 0000990004');
    await expect(page.getByText('dokumenty do podpisu')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Menu portalu' }).getByRole('link')).toHaveText(['Start', 'Sprawy', 'Płatności', 'Informacja', 'Pomoc', 'Konto']);
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
  await krok(page, 'Dane spółki z przejęciem i akcjonariusze — na jednej stronie; Złóż', async () => {
    await wypelnijReprezentanta(page, 'rep@example.com');
    await ui.wpisz(page, 'Kto dotąd prowadził rejestr', 'Dom Maklerski Testowy S.A.');
    await ui.wpiszDate(page, 'Od kiedy mamy prowadzić rejestr', jutro());
    await wypelnijAkcjonariuszy(page, 'rep@example.com');
    await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
    await ui.przycisk(page, 'Złóż — przygotuj dokumenty');
    await ui.gotowe(page, 'Pobierz dokument');
  });
  await krok(page, 'Dokumenty z poczty, podpisy, notariusz', async () => {
    await wgraj(dokument(page, 'Umowa spółki'));
    for (const nazwa of ['Umowa o prowadzenie', 'Uchwała']) {
      await wgraj(dokument(page, nazwa));
      await dokument(page, nazwa).getByRole('button', { name: 'Potwierdź podpis' }).click();
      await expect(dokument(page, nazwa).getByText('podpisany')).toBeVisible();
    }
    await dokument(page, 'Umowa o prowadzenie').locator('.podsekcja input[type="file"]').setInputFiles(PDF);
    await dokument(page, 'Umowa o prowadzenie').getByText('Umowa z podpisem notariusza').waitFor();
  });
  await krok(page, 'Numery akcji, sprawdzone; „Otwórz rejestr” dopiero od dnia przejęcia', async () => {
    await wpiszAkcjeISprawdz(page);
    await page.getByText(/Dostępne od/).first().waitFor();
    await expect(page.getByRole('button', { name: 'Otwórz rejestr' })).toBeDisabled();
    await ui.wpiszDate(page, 'Dzień przejęcia', dzis());
    await expect(page.getByRole('button', { name: 'Otwórz rejestr' })).toBeEnabled({ timeout: 10000 });
    await ui.przycisk(page, 'Otwórz rejestr');
    await page.waitForURL(/#\/spolki\/\d+/);
    await ui.gotowe(page, 'rejestr otwarty');
    await page.locator('.historia-wpisow').getByText('przejęcie od dotychczasowego podmiotu').waitFor();
  });
  await zakoncz(page);
});
