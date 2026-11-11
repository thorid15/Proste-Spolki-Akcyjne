'use strict';

/**
 * Kancelaria — ekrany z § 5 (Faza 3), każdy scenariusz przy 1440 i 390 px. Dane: `test:seed` — Alfa Testowa P.S.A.
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

/** Czeka, aż autozapis treści sprawy skończy, a „Dalej” będzie aktywne. */
async function dalej(page) {
  await page.getByText('Zapisano', { exact: true }).first().waitFor({ timeout: 10000 });
  const b = page.getByRole('button', { name: 'Dalej', exact: true });
  await expect(b).toBeEnabled({ timeout: 10000 });
  await b.click();
  await ui.gotowe(page, 'Osoby do powiadomienia');
}

const kafel = (page, nazwa) => page.locator('.kafel-osoby').filter({ hasText: nazwa });
const wiersz = (page, tekst) => page.getByRole('row').filter({ hasText: tekst });

test('zbycie: zbywca bez zgody na e-mail — list w Korespondencji, „Nadano”, wpis, powiadomienia o wpisie, wysyłka', async ({ page }, testInfo) => {
  await start(page, testInfo, 'zbycie-list', 'Sprawa: zbycie akcji');
  let adresSprawy = null;
  let numerListu = null;
  await krok(page, 'Kokpit — Nowy wpis', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Akcjonariusze');
    await page.getByRole('button', { name: 'Nowy wpis' }).click();
    await ui.gotowe(page, 'Dodaj zmianę');
    adresSprawy = new URL(page.url()).hash;
  });
  await krok(page, 'Krok 1 — żądający, zmiana, podstawa', async () => {
    await ui.wybierz(page, 'Kto żąda wpisu', 'osoba z kartoteki');
    await ui.wybierzZKartoteki(page, 'Osoba żądająca', 'Ułamkowa');
    await ui.przycisk(page, 'Przeniesienie');
    await ui.wybierzZKartoteki(page, 'Zbywca', 'Bezzgody');
    await ui.wybierzZKartoteki(page, 'Nabywca 1', 'Ułamkowa');
    await ui.wpisz(page, 'Seria', 'A');
    await ui.wpisz(page, 'Numery', '951-1000');
    await ui.wpisz(page, 'Liczba', '50');
    await ui.wpisz(page, 'Opis dokumentu', 'Umowa sprzedaży akcji (dane testowe)');
  });
  await krok(page, 'Dalej — powiadomienie listem', async () => {
    await dalej(page);
    await kafel(page, 'Jan Bezzgody').getByText('Powiadomienie — list').waitFor();
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
  await krok(page, 'Sprawdzenie — checklista, opłata', async () => {
    await page.goto(`/${adresSprawy}`);
    await ui.gotowe(page, 'Osoby do powiadomienia');
    await kafel(page, 'Jan Bezzgody').getByText(/^Wysłano /).waitFor();
    await ui.checklista(page);
    await ui.przycisk(page, 'Bez opłaty');
    await expect(page.getByRole('button', { name: 'Dokonaj wpisu' })).toBeEnabled({ timeout: 10000 });
  });
  await krok(page, 'Dokonaj wpisu', async () => {
    await ui.przycisk(page, 'Dokonaj wpisu');
    await page.getByRole('dialog').getByRole('button', { name: 'Dokonaj wpisu' }).click();
    await ui.gotowe(page, 'Powiadomienia o wpisie');
    await wiersz(page, 'Alfa Testowa').filter({ hasText: 'e-mail' }).waitFor();
    await wiersz(page, 'Ewa Ułamkowa').filter({ hasText: 'list' }).waitFor();
  });
  await krok(page, 'Wyślij pisma', async () => {
    await ui.przycisk(page, 'Wyślij pisma');
    await wiersz(page, 'Alfa Testowa').getByText('Wysłane').waitFor({ timeout: 10000 });
  });
  await krok(page, 'Korespondencja — wysłane', async () => {
    await page.goto('/#/korespondencja?filtr=wyslane');
    await wiersz(page, 'Alfa Testowa').filter({ hasText: 'Powiadomienie o wpisie' }).first().waitFor();
  });
  await zakoncz(page);
});

test('zmiana treści po kroku 1: niewysłane powiadomienie znika, wysłane traci ważność — powstaje nowe', async ({ page }, testInfo) => {
  await start(page, testInfo, 'zmiana-tresci', 'Sprawa: Zmień treść (R2)');
  const przed = await api(page, 'GET', '/api/psa/sprawy/2');
  const stare = przed.osoby[0].powiadomienie;
  await krok(page, 'Sprawa po kroku 1 — Nadano w kafelku', async () => {
    await page.goto('/#/sprawy/2');
    await ui.gotowe(page, 'Osoby do powiadomienia');
    await kafel(page, 'Jan Bezzgody').getByRole('button', { name: 'Nadano' }).click();
    await kafel(page, 'Jan Bezzgody').getByText(/^Wysłano /).waitFor();
  });
  await krok(page, 'Więcej — Zmień treść', async () => {
    await ui.przycisk(page, 'Więcej');
    await page.getByRole('menuitem', { name: 'Zmień treść' }).click();
    await ui.gotowe(page, 'Dodaj zmianę');
    await ui.wpisz(page, 'Numery', '601-640');
    await ui.wpisz(page, 'Liczba', '40');
  });
  await krok(page, 'Dalej — nowe powiadomienie', async () => {
    await dalej(page);
    await kafel(page, 'Jan Bezzgody').getByText('Powiadomienie — list').waitFor();
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
  await krok(page, 'Kokpit — Stan na dzień', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Akcjonariusze');
    await ui.wpiszDate(page, 'Stan na dzień', '2026-03-31');
    await sprawdz('Stan na dzień');
  });
  await krok(page, 'Sprawa — Data wpływu żądania (kropki wstawiają się same)', async () => {
    await page.getByRole('button', { name: 'Nowy wpis' }).click();
    await ui.gotowe(page, 'Dodaj zmianę');
    const pole = ui.pole(page, 'Data wpływu żądania').locator('.pole-daty-wejscie');
    await pole.fill('');
    await pole.pressSequentially('01112026');
    await expect(pole).toHaveValue('01.11.2026');
    await sprawdz('Data wpływu żądania');
  });
  await zakoncz(page);
});
