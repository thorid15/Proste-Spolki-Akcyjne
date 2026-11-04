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
  await krok(page, 'Zbycie akcji (kokpit)', async () => {
    await page.getByRole('button', { name: 'Zbycie akcji' }).first().click();
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

/** Wspólny pomocnik (ui.checklista) — odhacza i czeka na aktywne „Dokonaj wpisu”. */
const checklista = (page) => ui.checklista(page);

test('zbycie: zbywca bez zgody na e-mail — powiadomienie listem, nadanie, wpis', async ({ page }, testInfo) => {
  await doKreatora(page, testInfo, 'zbycie-bez-zgody', 'Bartosz Próbny → Celina Nabywczyni');
  await coSieZbywa(page, { zbywca: 'Próbny', ilosc: 100, nabywca: 'Nabywczyni' });
  await podstawa(page);
  await krok(page, 'Sprawdzenie i wpis — powiadomienie', async () => {
    await page.getByRole('button', { name: 'Wyślij powiadomienie' }).first().click();
    // A-008 (zmienione w tej sesji): stan listu w panelu zamiast okna `alert`; ponownego „Wyślij powiadomienie” nie ma.
    await page.getByText('Powiadomienie czeka w kolejce listów').first().waitFor({ timeout: 10000 });
    if (page.__rejestrator._dialogi.length) throw new Error(`okno natywne po wysłaniu: ${page.__rejestrator._dialogi.join(' | ')}`);
    // Po odświeżeniu sprawy przycisk nie może wrócić (drugi list) — sprawdzane po ustaleniu stanu.
    await page.waitForTimeout(1500);
    if (await page.getByRole('button', { name: 'Wyślij powiadomienie' }).count()) throw new Error('„Wyślij powiadomienie” nadal widoczne — możliwy drugi list');
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

// ── Warianty (D-089, art. 300(34) § 6, art. 300(40), art. 300(42)) — stan wstępny zwykłym API, dane fikcyjne ──

const { api } = require('../pomocnicze/srodowisko');

async function dokonczZbycie(page, { warunkowe, list = null } = {}) {
  await podstawa(page);
  const adresSprawy = page.url();
  await krok(page, 'Sprawdzenie i wpis — pole warunkowe, powiadomienie', async () => {
    if (warunkowe) {
      const pole = page.locator('label.chk', { hasText: warunkowe }).first();
      await pole.waitFor({ timeout: 10000 }); // pole warunkowe widoczne, bo rejestr tego wymaga
    }
    await page.getByRole('button', { name: 'Wyślij powiadomienie' }).first().click();
    await ui.gotowe(page);
  });
  if (list) {
    // Zbywca bez zgody na e-mail — list w kolejce blokuje wpis do nadania (R4 K3).
    await krok(page, 'Kolejka listów — nadanie', async () => {
      await page.goto('/#/listy');
      await ui.gotowe(page, 'Listy');
      await page.locator('.karta, tr').filter({ hasText: list }).last().getByRole('button', { name: 'Nadano' }).first().click();
      await ui.wpiszDate(page, 'Data nadania', DZIS);
      await ui.wpisz(page, 'Numer nadania', 'RR000000001PL');
      await page.getByRole('button', { name: 'Zapisz nadanie' }).first().click();
      await ui.gotowe(page);
    });
  }
  await krok(page, 'Wpis', async () => {
    if (list) { await page.goto(adresSprawy); await ui.gotowe(page, 'Dokonaj wpisu'); }
    await checklista(page);
    await ui.przycisk(page, 'Dokonaj wpisu');
    await ui.gotowe(page, 'wpis dokonany');
  });
  await zakoncz(page);
}

test('zbycie: akcje niepokryte — zgoda spółki (art. 300(40) § 1) i komunikat o solidarnej odpowiedzialności', async ({ page }, testInfo) => {
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  const emisja = await api(page, 'POST', '/api/psa/spolki/1/zdarzenia', { typ: 'emisja', dane: { seria: 'B', nr_pierwszy: 1001, ilosc: 100, data_wpisu_krs: DZIS, rodzaj_akcji: 'zwykla', tytul: 'Emisja serii B (dane fikcyjne)' } });
  await api(page, 'POST', '/api/psa/spolki/1/zdarzenia', { typ: 'objecie', dane: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: 3, ilosc: 100, pokryta: 'nie' }] } });
  await doKreatora(page, testInfo, 'zbycie-niepokryte', 'Celina Nabywczyni (akcje B niepokryte) → Bartosz Próbny');
  await coSieZbywa(page, { zbywca: 'Nabywczyni', ilosc: 10, nabywca: 'Próbny' });
  await dokonczZbycie(page, { warunkowe: 'Uzyskano zgodę spółki na zbycie akcji nie w pełni pokrytych', list: 'Nabywczyni' });
});

test('zbycie: ograniczenie — wymagana zgoda spółki (art. 300(34) § 6)', async ({ page }, testInfo) => {
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  await api(page, 'POST', '/api/psa/spolki/1/zdarzenia', { typ: 'ograniczenie', dane: { zakres: 'emisja', emisja_zdarzenie_id: 1, wymaga_zgody_spolki: true, zgoda_termin_wskazania_dni: 30, zgoda_cena_opis: 'wartość godziwa (dane fikcyjne)', zgoda_termin_zaplaty_dni: 14, opis: 'Zbycie wymaga zgody spółki (dane fikcyjne)' } });
  await doKreatora(page, testInfo, 'zbycie-zgoda-spolki', 'Anna Testowa → Celina Nabywczyni');
  await coSieZbywa(page, { zbywca: 'Testowa', ilosc: 20, nabywca: 'Nabywczyni' });
  await dokonczZbycie(page, { warunkowe: 'Uzyskano zgodę spółki na rozporządzenie akcjami' });
});

test('zbycie: prawo pierwszeństwa (art. 300(42)) — „wyczerpane”', async ({ page }, testInfo) => {
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  await api(page, 'POST', '/api/psa/spolki/1/zdarzenia', { typ: 'ograniczenie', dane: { zakres: 'emisja', emisja_zdarzenie_id: 1, prawo_pierwszenstwa: true, opis: 'Prawo pierwszeństwa akcjonariuszy (dane fikcyjne)' } });
  await doKreatora(page, testInfo, 'zbycie-pierwszenstwo', 'Anna Testowa → Celina Nabywczyni');
  await coSieZbywa(page, { zbywca: 'Testowa', ilosc: 20, nabywca: 'Nabywczyni' });
  await dokonczZbycie(page, { warunkowe: 'Prawo pierwszeństwa nabycia akcji zostało wyczerpane' });
});

test('zbycie: nowy nabywca spoza kartoteki („Nowy nabywca” w kroku 1)', async ({ page }, testInfo) => {
  await doKreatora(page, testInfo, 'zbycie-nowy-nabywca', 'Anna Testowa → Feliks Nowy (spoza kartoteki)');
  await krok(page, 'Co się zbywa — nowy nabywca', async () => {
    await ui.wybierz(page, 'Zbywca', 'Testowa');
    await ui.wpisz(page, 'Liczba zbywanych akcji', 30);
    await page.getByRole('button', { name: 'Nowy nabywca (spoza kartoteki)' }).click();
    await ui.wpisz(page, 'Imię', 'Feliks');
    await ui.wpisz(page, 'Nazwisko', 'Nowy');
    await ui.wpisz(page, 'PESEL', '92010124683').catch(() => {});
    await ui.wpisz(page, 'Kod pocztowy', '80-006');
    await ui.wpisz(page, 'Miejscowość', 'Gdańsk');
    await ui.wpisz(page, 'Nr domu / lokalu', '6');
    await page.getByRole('button', { name: 'Zapisz w kartotece' }).click();
    await page.getByRole('button', { name: 'Zapisz w kartotece' }).waitFor({ state: 'detached', timeout: 10000 });
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Data umowy zbycia');
  });
  await krok(page, 'Podstawa', async () => {
    await ui.wpiszDate(page, 'Data umowy zbycia', DZIS);
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Dokonaj wpisu');
  });
  await krok(page, 'Sprawdzenie i wpis', async () => {
    await page.getByRole('button', { name: 'Wyślij powiadomienie' }).first().click();
    await ui.gotowe(page);
    await checklista(page);
    await ui.przycisk(page, 'Dokonaj wpisu');
    await ui.gotowe(page, 'wpis dokonany');
  });
  await zakoncz(page);
});

test('zbycie: jedna umowa, dwóch nabywców = dwie sprawy (zaakceptowane 3.11.2026) — koszt', async ({ page }, testInfo) => {
  await doKreatora(page, testInfo, 'zbycie-dwoch-nabywcow', 'Anna Testowa → Celina Nabywczyni + Bartosz Próbny');
  for (const [nabywca, ilosc] of [['Nabywczyni', 10], ['Próbny', 15]]) {
    if (nabywca === 'Próbny') {
      await krok(page, 'Druga sprawa — znów z kokpitu', async () => {
        await page.goto('/#/spolki/1');
        await ui.gotowe(page, 'Alfa Testowa');
        await page.getByRole('button', { name: 'Zbycie akcji' }).first().click();
        await ui.gotowe(page, 'Co się zbywa');
      });
    }
    await coSieZbywa(page, { zbywca: 'Testowa', ilosc, nabywca });
    await podstawa(page);
    await krok(page, `Sprawdzenie i wpis — ${nabywca}`, async () => {
      await page.getByRole('button', { name: 'Wyślij powiadomienie' }).first().click();
      await ui.gotowe(page);
      await checklista(page);
      await ui.przycisk(page, 'Dokonaj wpisu');
      await ui.gotowe(page, 'wpis dokonany');
    });
  }
  await zakoncz(page);
});
