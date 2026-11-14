'use strict';

/**
 * Kancelaria — rejestr spółki i wpis na jednej stronie (D-230, D-231), każdy scenariusz przy 1440 i 390 px. Dane: `test:seed` — Alfa Testowa P.S.A.
 * (e-mail spółki), Anna Testowa (zgoda e-mail), Jan Bezzgody (bez zgody, akcje A 601–1000), Ewa Ułamkowa;
 * sprawa nr 2 — zbycie Jan → Ewa (A 601–650) po kroku 1, powiadomienie listem czeka na „Nadano”.
 */

const { test, expect, zaloguj, api } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');

const szer = (ti) => Number(ti.project.name);

async function start(page, testInfo, scenariusz, proces) {
  rozpocznij(page, testInfo, { scenariusz, proces, szerokosc: szer(testInfo), persona: 'notariusz' });
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
}

/** Czeka, aż autozapis treści wpisu skończy (sprawa powstaje przy pierwszym zapisie — D-231). */
async function zapisano(page) {
  await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

const kafel = (page, nazwa) => page.locator('.kafel-osoby').filter({ hasText: nazwa });
const wiersz = (page, tekst) => page.getByRole('row').filter({ hasText: tekst });
const akcjonariusz = (page, nazwa) => page.locator('.akcjonariusz').filter({ hasText: nazwa });
const liczbaSpraw = async (page) => (await api(page, 'GET', '/api/psa/sprawy')).length;

async function dokonajWpisu(page) {
  await ui.przycisk(page, 'Dokonaj wpisu');
  await page.getByRole('dialog').getByRole('button', { name: 'Dokonaj wpisu' }).click();
  await ui.gotowe(page, 'Wpisano do rejestru');
}

test('zbycie: „Nowy wpis” przy akcjonariuszu, jedna strona; zbywca bez zgody na e-mail — list, „Nadano”, wpis, powiadomienia o wpisie', async ({ page }, testInfo) => {
  await start(page, testInfo, 'zbycie-list', 'Wpis: zbycie akcji');
  let adresSprawy = null;
  let numerListu = null;
  await krok(page, 'Rejestr — Nowy wpis przy akcjonariuszu; sam formularz nie zakłada sprawy', async () => {
    const przed = await liczbaSpraw(page);
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Akcjonariusze');
    await akcjonariusz(page, 'Jan Bezzgody').getByRole('link', { name: 'Nowy wpis' }).click();
    await ui.gotowe(page, 'Co się zmienia');
    await ui.przycisk(page, 'Zbycie akcji');
    await page.getByText('Jan Bezzgody posiada').waitFor();
    await ui.przycisk(page, 'Zmień rodzaj wpisu');
    await page.waitForTimeout(1200);
    if ((await liczbaSpraw(page)) !== przed) throw new Error('otwarcie formularza i wybór rodzaju założyły sprawę');
  });
  await krok(page, 'Dane wpisu i podstawa — zbywca z wiersza rejestru, numery wpisuje pracownik', async () => {
    await ui.przycisk(page, 'Zbycie akcji');
    await ui.pole(page, 'Zbywca').getByText('Jan Bezzgody').waitFor();
    await ui.wybierzZKartoteki(page, 'Nabywca 1', 'Ułamkowa');
    await ui.wpisz(page, 'Seria', 'A');
    await ui.wpisz(page, 'Numery', '951-1000');
    await ui.wpisz(page, 'Liczba', '50');
    await ui.wpisz(page, 'Dokument', 'Umowa sprzedaży akcji (dane testowe)');
    await ui.wybierz(page, 'Kto żąda wpisu', 'osoba z kartoteki');
    await ui.wybierzZKartoteki(page, 'Osoba żądająca', 'Ułamkowa');
    await zapisano(page);
    await page.waitForURL(/#\/sprawy\/\d+/);
    adresSprawy = new URL(page.url()).hash;
    await page.getByRole('heading', { name: /Po wpisie/ }).waitFor();
    await akcjonariusz(page, 'Ewa Ułamkowa').getByText('951–1000').waitFor();
  });
  await krok(page, 'Przygotuj powiadomienia — list do zbywcy', async () => {
    await ui.przycisk(page, 'Przygotuj powiadomienia');
    await kafel(page, 'Jan Bezzgody').getByText('Powiadomienie gotowe — list').waitFor();
    const p = await api(page, 'GET', `/api/psa/sprawy/${adresSprawy.split('/').pop()}`);
    numerListu = p.osoby[0].powiadomienie.numer;
  });
  await krok(page, 'Korespondencja — Nadano', async () => {
    await page.getByRole('button', { name: 'Korespondencja' }).filter({ visible: true }).first().click();
    await ui.przycisk(page, 'Listy do nadania');
    const w = wiersz(page, numerListu);
    await w.getByRole('button', { name: 'Nadano' }).click();
    await expect(w).toHaveCount(0, { timeout: 10000 });
  });
  await krok(page, 'Przed wpisem — sprawdzone, opłata', async () => {
    await page.goto(`/${adresSprawy}`);
    await ui.gotowe(page, 'Przed wpisem');
    await kafel(page, 'Jan Bezzgody').getByText(/^Powiadomienie wysłane /).waitFor();
    await ui.checklista(page);
    await ui.przycisk(page, 'Bez opłaty');
    await page.getByText('Wszystko gotowe do wpisu.').waitFor({ timeout: 10000 });
  });
  await krok(page, 'Dokonaj wpisu — potwierdzenie z treścią wpisu', async () => {
    await ui.przycisk(page, 'Dokonaj wpisu');
    await page.getByRole('dialog').getByText('Przeniesienie akcji z Jan Bezzgody na Ewa Ułamkowa').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Dokonaj wpisu' }).click();
    await ui.gotowe(page, 'Wpisano do rejestru');
    await wiersz(page, 'Alfa Testowa').filter({ hasText: 'e-mail' }).waitFor();
    await wiersz(page, 'Ewa Ułamkowa').filter({ hasText: 'list' }).waitFor();
  });
  await krok(page, 'Wyślij e-maile', async () => {
    await page.getByRole('button', { name: /^Wyślij e-maile/ }).click();
    await wiersz(page, 'Alfa Testowa').getByText('Wysłane').waitFor({ timeout: 10000 });
  });
  await krok(page, 'Rejestr po wpisie — historia z opisem zdaniem', async () => {
    await ui.przycisk(page, 'Wróć do rejestru', { exact: false }).catch(() => page.getByRole('link', { name: 'Wróć do rejestru' }).click());
    await ui.gotowe(page, 'Historia wpisów');
    await page.locator('.historia-wpisow').getByText('Przeniesienie akcji z Jan Bezzgody na Ewa Ułamkowa: seria A nr 951–1000').waitFor();
  });
  await zakoncz(page);
});

test('zastaw: akcjonariuszka ze zgodą na e-mail — powiadomienie e-mailem z tej samej strony, wpis, znacznik w rejestrze', async ({ page }, testInfo) => {
  await start(page, testInfo, 'zastaw-email', 'Wpis: zastaw');
  await krok(page, 'Rejestr — Nowy wpis przy akcjonariuszce, zastaw', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Akcjonariusze');
    await akcjonariusz(page, 'Anna Testowa').getByRole('link', { name: 'Nowy wpis' }).click();
    await ui.gotowe(page, 'Co się zmienia');
    await ui.przycisk(page, 'Zastaw, użytkowanie albo zajęcie');
    await page.getByText('Anna Testowa posiada').waitFor();
    await ui.wybierzZKartoteki(page, 'Uprawniony', 'Bank');
    await ui.wpisz(page, 'Seria', 'A');
    await ui.wpisz(page, 'Numery', '201-300');
    await ui.wpisz(page, 'Liczba', '100');
    await ui.wpisz(page, 'Dokument', 'Umowa zastawu (dane testowe)');
    await zapisano(page);
  });
  await krok(page, 'Przygotuj powiadomienia — e-mail, Wyślij', async () => {
    await ui.przycisk(page, 'Przygotuj powiadomienia');
    await kafel(page, 'Anna Testowa').getByText('Powiadomienie gotowe — e-mail').waitFor();
    await kafel(page, 'Anna Testowa').getByRole('button', { name: 'Wyślij' }).click();
    await kafel(page, 'Anna Testowa').getByText(/^Powiadomienie wysłane /).waitFor({ timeout: 10000 });
  });
  await krok(page, 'Sprawdzone, opłata, wpis', async () => {
    await ui.checklista(page);
    await ui.przycisk(page, 'Opłata 100 zł netto');
    await page.getByText('Wszystko gotowe do wpisu.').waitFor({ timeout: 10000 });
    await dokonajWpisu(page);
  });
  await krok(page, 'Rejestr — znacznik zastawu przy pakiecie', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Akcjonariusze');
    await akcjonariusz(page, 'Anna Testowa').getByText('zastaw na nr 201–300').waitFor();
  });
  await zakoncz(page);
});

test('zmiana treści po przygotowaniu powiadomień: wysłane traci ważność — powstaje nowe (R2)', async ({ page }, testInfo) => {
  await start(page, testInfo, 'zmiana-tresci', 'Wpis: Zmień treść (R2)');
  const przed = await api(page, 'GET', '/api/psa/sprawy/2');
  const stare = przed.osoby[0].powiadomienie;
  await krok(page, 'Wpis w toku z rejestru — Dokończ, Nadano w kafelku', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'W toku');
    await page.getByRole('link', { name: 'Dokończ' }).click();
    await ui.gotowe(page, 'Przed wpisem');
    await kafel(page, 'Jan Bezzgody').getByRole('button', { name: 'Nadano' }).click();
    await kafel(page, 'Jan Bezzgody').getByText(/^Powiadomienie wysłane /).waitFor();
  });
  await krok(page, 'Zmień treść — ostrzeżenie o wysłanym powiadomieniu', async () => {
    await ui.przycisk(page, 'Zmień treść');
    await page.getByRole('dialog').getByRole('button', { name: 'Zmień treść' }).click();
    await page.getByRole('button', { name: 'Przygotuj powiadomienia' }).waitFor({ timeout: 10000 });
    await ui.wpisz(page, 'Numery', '601-640');
    await ui.wpisz(page, 'Liczba', '40');
    await zapisano(page);
  });
  await krok(page, 'Przygotuj powiadomienia — nowe powiadomienie', async () => {
    await ui.przycisk(page, 'Przygotuj powiadomienia');
    await kafel(page, 'Jan Bezzgody').getByText('Powiadomienie gotowe — list').waitFor();
    const po = await api(page, 'GET', '/api/psa/sprawy/2');
    const nowe = po.osoby[0].powiadomienie;
    if (!nowe || nowe.id === stare.id || nowe.stan !== 'do_wyslania') throw new Error(`oczekiwano nowego powiadomienia, jest ${JSON.stringify(nowe)}`);
    if (!po.pisma.find((p) => p.id === stare.id).uniewaznione) throw new Error('wysłane powiadomienie nie straciło ważności');
  });
  await zakoncz(page);
});

test('karta osoby: „Edytuj” w miejscu, historia zmian; nowa osoba z kartoteki', async ({ page }, testInfo) => {
  await start(page, testInfo, 'karta-osoby', 'Karta osoby (U-25)');
  await krok(page, 'Karta osoby — Edytuj', async () => {
    await page.goto('/#/osoby/2');
    await ui.gotowe(page, 'Jan Bezzgody');
    await ui.przycisk(page, 'Edytuj');
    await ui.wpisz(page, 'Adres', 'ul. Nowa 7, 80-004 Gdańsk');
    await ui.przycisk(page, 'Zapisz');
    await page.getByText('ul. Nowa 7, 80-004 Gdańsk').first().waitFor();
  });
  await krok(page, 'Historia zmian', async () => {
    await page.getByRole('button', { name: /Historia zmian/ }).click();
    await wiersz(page, 'adres').filter({ hasText: 'ul. Nowa 7' }).waitFor();
  });
  await krok(page, 'Kartoteka — nowa osoba', async () => {
    await page.goto('/#/osoby');
    await ui.przycisk(page, 'Nowa osoba');
    await ui.wpisz(page, 'Imię i nazwisko', 'Edward Ewidencyjny');
    await ui.wpisz(page, 'PESEL', '44051401359');
    await ui.wpisz(page, 'Adres', 'ul. Krótka 2, 80-001 Gdańsk');
    await ui.przycisk(page, 'Zapisz osobę');
    await ui.gotowe(page, 'Edward Ewidencyjny');
  });
  await zakoncz(page);
});

test('pola dat: pełny format DD.MM.RRRR widoczny bez ucięcia', async ({ page }, testInfo) => {
  await start(page, testInfo, 'pola-dat', 'Pole daty (§ 5)');
  const sprawdz = async (etykieta) => {
    const pole = ui.pole(page, etykieta).locator('.pole-daty-wejscie');
    const { wartosc, uciete } = await pole.evaluate((e) => ({ wartosc: e.value, uciete: e.scrollWidth > e.clientWidth }));
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(wartosc)) throw new Error(`${etykieta}: wartość „${wartosc}”`);
    if (uciete) throw new Error(`${etykieta}: data ucięta przy ${szer(testInfo)} px`);
  };
  await krok(page, 'Rejestr — Stan na dzień', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Akcjonariusze');
    const pole = page.locator('.stan-na .pole-daty-wejscie');
    await pole.fill('31.03.2026');
    const { wartosc, uciete } = await pole.evaluate((e) => ({ wartosc: e.value, uciete: e.scrollWidth > e.clientWidth }));
    if (wartosc !== '31.03.2026' || uciete) throw new Error(`Stan na dzień: „${wartosc}”, ucięte: ${uciete}`);
    await page.getByText('tylko do odczytu').waitFor();
  });
  await krok(page, 'Wpis — Żądanie wpłynęło (kropki wstawiają się same)', async () => {
    await page.goto('/#/spolki/1/wpis');
    await ui.gotowe(page, 'Co się zmienia');
    const pole = ui.pole(page, 'Żądanie wpłynęło').locator('.pole-daty-wejscie');
    await pole.fill('');
    await pole.pressSequentially('01112026');
    await expect(pole).toHaveValue('01.11.2026');
    await sprawdz('Żądanie wpłynęło');
  });
  await zakoncz(page);
});

test('konto pracownika: „Zmień hasło” w menu konta — potem logowanie nowym hasłem', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'zmiana-hasla', proces: 'Zmiana hasła pracownika', szerokosc: szer(testInfo), persona: 'pracownik' });
  await zaloguj(page, 'pracownik@example.com', 'kancelaria');
  await krok(page, 'Menu konta → Zmień hasło', async () => {
    await page.goto('/#/');
    await page.getByRole('button', { name: /Konto/ }).click();
    await page.getByRole('button', { name: 'Zmień hasło' }).click();
    await ui.gotowe(page, 'Obecne hasło');
  });
  await krok(page, 'Nowe hasło → ponowne logowanie', async () => {
    await page.locator('.pole-haslo input').nth(0).fill('Test-Haslo-2026');
    await page.locator('.pole-haslo input').nth(1).fill('Nowe-Haslo-Pracownika-2026');
    await ui.przycisk(page, 'Zapisz');
    await ui.gotowe(page, 'Hasło zmienione');
    await ui.przycisk(page, 'Zaloguj się');
    await page.locator('.pole-haslo input').first().waitFor();
  });
  await zakoncz(page);
});
