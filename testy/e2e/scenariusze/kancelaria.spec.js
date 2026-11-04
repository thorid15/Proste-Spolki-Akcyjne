'use strict';

/**
 * Kancelaria — procesy poza kreatorem wpisu (K1–K3, K6, K7, K11–K14) i ścieżka „spółka żąda wpisu, a nie ma jej
 * w kartotece”. Dane: `test:seed` (Alfa, Gamma — wniosek z dokumentami u klienta, przeniesienia w każdym statusie § 7.3).
 */

const { test, zaloguj, api } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');

const szer = (ti) => Number(ti.project.name);
const DZIS = new Date().toISOString().slice(0, 10);
const PDF = { name: 'protokol-podpisany.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% dane fikcyjne\n%%EOF\n') };

async function start(page, testInfo, scenariusz, proces, persona = 'notariusz') {
  rozpocznij(page, testInfo, { scenariusz, proces, szerokosc: szer(testInfo), persona });
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
}

test('K13: kartoteka — nowa osoba, edycja danych i AML', async ({ page }, testInfo) => {
  await start(page, testInfo, 'kartoteka', 'K13 kartoteka');
  await krok(page, 'Kartoteka osób', async () => {
    await page.goto('/#/osoby');
    await ui.gotowe(page, 'Nowa osoba');
  });
  await krok(page, 'Nowa osoba — formularz', async () => {
    await page.getByRole('button', { name: 'Nowa osoba', exact: true }).first().click();
    await ui.wpisz(page, 'Imię', 'Edward');
    await ui.wpisz(page, 'Nazwisko', 'Ewidencyjny');
    await ui.wpisz(page, 'Numer PESEL', '79072213578').catch(() => {});
    await ui.wpisz(page, 'Kod pocztowy', '80-005');
    await ui.wpisz(page, 'Miejscowość', 'Gdańsk');
    await ui.wpisz(page, 'Ulica', 'Ewidencyjna').catch(() => {});
    await ui.wpisz(page, 'Nr domu', '5');
    await page.getByRole('button', { name: 'Dodaj do kartoteki' }).click();
    await page.getByRole('button', { name: 'Dodaj do kartoteki' }).waitFor({ state: 'detached', timeout: 10000 });
  });
  await krok(page, 'Profil osoby — edycja i AML', async () => {
    await page.goto('/#/osoby/1');
    await ui.gotowe(page, 'Edytuj dane');
    await page.getByRole('button', { name: 'Edytuj dane' }).click();
    await ui.wpisz(page, 'Telefon', '500100200');
    await ui.pole(page, 'Środki bezpieczeństwa finansowego (AML)').locator('select').selectOption({ index: 1 }).catch(() => {});
    await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
    await page.getByRole('button', { name: 'Zapisz zmiany' }).waitFor({ state: 'detached', timeout: 10000 });
  });
  await zakoncz(page);
});

test('K14: opłaty — nowa opłata ręczna', async ({ page }, testInfo) => {
  await start(page, testInfo, 'oplaty', 'K14 opłaty');
  await krok(page, 'Opłaty', async () => {
    await page.goto('/#/oplaty');
    await ui.gotowe(page, '+ Nowa opłata');
  });
  await krok(page, 'Nowa opłata', async () => {
    await page.getByRole('button', { name: '+ Nowa opłata' }).click();
    await ui.pole(page, 'Spółka').locator('select').selectOption({ index: 1 });
    await ui.pole(page, 'Rodzaj opłaty').locator('select').selectOption({ index: 1 });
    await ui.wpisz(page, 'Rok (okres)', '2026').catch(() => {});
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  });
  await zakoncz(page);
});

test('K1–K2: zgłoszenia wstępne i obsługa wniosku Gamma (zakładki)', async ({ page }, testInfo) => {
  await start(page, testInfo, 'wniosek-kancelaria', 'K1 zgłoszenia, K2 wniosek');
  await krok(page, 'Zgłoszenia wstępne', async () => {
    await page.goto('/#/zgloszenia');
    await ui.gotowe(page);
  });
  await krok(page, 'Wnioski', async () => {
    await page.goto('/#/wnioski');
    await ui.gotowe(page, 'Gamma');
  });
  for (const zakladka of ['Dane spółki', 'Akcjonariusze', 'Dokumenty', 'Decyzja']) {
    await krok(page, `Wniosek — ${zakladka}`, async () => {
      if (!page.url().includes('/wnioski/1')) await page.goto('/#/wnioski/1');
      await page.getByRole('tab', { name: new RegExp(zakladka) }).or(page.getByRole('button', { name: new RegExp(`^${zakladka}`) })).first().click();
      await page.waitForTimeout(500);
      if (zakladka === 'Akcjonariusze') {
        const sprawdz = page.getByRole('button', { name: 'Zapisz i oznacz jako sprawdzony' }).first();
        if (await sprawdz.isVisible().catch(() => false)) await sprawdz.click();
      }
    });
  }
  await zakoncz(page);
});

test('K3a: nowa spółka w kancelarii — pomiar pól w każdym z 4 kroków', async ({ page }, testInfo) => {
  await start(page, testInfo, 'nowa-spolka-kancelaria', 'K3a otwarcie rejestru — nowa spółka');
  await krok(page, 'Spółki → Nowa spółka', async () => {
    await page.goto('/#/spolki');
    await page.getByRole('button', { name: 'Dodaj spółkę' }).first().click();
    await ui.gotowe(page, 'Numer KRS');
  });
  await krok(page, 'Krok 1 — Spółka (Pobierz z KRS)', async () => {
    await ui.wpisz(page, 'Numer KRS', '0000990003');
    const pobierz = page.getByRole('button', { name: /Pobierz z KRS|Pobierz/ }).first();
    if (await pobierz.isVisible().catch(() => false)) await pobierz.click();
    await page.waitForTimeout(800);
  });
  for (const [nr, nazwa] of [[2, 'Umowa o prowadzenie rejestru'], [3, 'Pierwsza emisja i akcjonariat'], [4, 'Weryfikacja']]) {
    await krok(page, `Krok ${nr} — ${nazwa} (pomiar)`, async () => {
      await page.locator('.kroki, nav, ol').getByText(nazwa).first().click();
      await page.waitForTimeout(500);
    });
  }
  await zakoncz(page);
});

test('K3c: przejęcie rejestru (Theta, „Uzgodnienie”) — checklista odbioru, protokół, „Aktywny”', async ({ page }, testInfo) => {
  await start(page, testInfo, 'przejecie-rejestru', 'K3c przejęcie rejestru');
  const { przeniesienia } = await api(page, 'GET', '/api/psa/przeniesienia');
  const theta = przeniesienia.find((p) => p.status === 'uzgodnienie');
  await krok(page, 'Przeniesienia — lista', async () => {
    await page.goto('/#/przeniesienia');
    await ui.gotowe(page, 'Theta');
  });
  await krok(page, 'Przeniesienie — Etap 6 checklista odbioru', async () => {
    await page.goto(`/#/przeniesienia/${theta.id}`);
    await ui.gotowe(page, 'Etap 6');
    const karta = page.locator('.karta', { hasText: 'Etap 6' });
    const pola = karta.locator('input[type="checkbox"]');
    // Checklista zapisuje się na serwerze po każdym kliknięciu — stan pola zmienia się po odpowiedzi.
    for (let i = 0; i < await pola.count(); i += 1) {
      if (!(await pola.nth(i).isChecked())) { await pola.nth(i).click(); await page.waitForTimeout(300); }
    }
  });
  await krok(page, 'Etap 7 — pobierz protokół, wgraj podpisany', async () => {
    const karta = page.locator('.karta', { hasText: 'Etap 7' });
    await page.request.get(`/api/psa/przeniesienia/${theta.id}/protokol.pdf`); // = „Pobierz protokół przejęcia (PDF)”
    await karta.locator('input[type="file"]').setInputFiles(PDF);
    await karta.getByRole('button', { name: 'Wgraj protokół podpisany przez notariusza' }).click();
    await page.waitForTimeout(800);
  });
  // „Aktywny” ustawia dopiero otwarcie rejestru zdarzeniem PRZEJĘCIE (server/trasy/spolki.js:939) — bez osobnego przejścia.
  await krok(page, 'Otwórz rejestr — PRZEJĘCIE → kokpit spółki', async () => {
    await page.getByRole('button', { name: /Otwórz rejestr — PRZEJĘCIE/ }).click();
    await ui.gotowe(page, 'Theta');
  });
  await zakoncz(page);
});

test('K3c: z kokpitu przejmowanej spółki do otwarcia PRZEJĘCIEM (B-004)', async ({ page }, testInfo) => {
  test.fail(true, 'B-004 — kokpit nie prowadzi do /spolki/:id/otworz (docs/analiza/BLEDY.md)');
  await start(page, testInfo, 'przejecie-otwarcie', 'K3c otwarcie PRZEJĘCIEM');
  const { przeniesienia } = await api(page, 'GET', '/api/psa/przeniesienia');
  const theta = przeniesienia.find((p) => p.status === 'uzgodnienie');
  await krok(page, 'Kokpit przejmowanej spółki → „Otwórz rejestr”', async () => {
    await page.goto(`/#/spolki/${theta.spolka_id}`);
    await ui.gotowe(page, 'Theta');
    await page.getByRole('button', { name: /^Otwórz rejestr/ }).first().click({ timeout: 5000 });
  });
  await zakoncz(page);
});

test('K6: sprawa z portalu — „Rozpocznij weryfikację” → „Ustal podstawę wpisu” → wpis', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'sprawa-z-portalu', proces: 'K6 sprawa z portalu', szerokosc: szer(testInfo), persona: 'Zarząd Alfa → notariusz' });
  await zaloguj(page, 'zarzad@example.com', 'portal');
  const { sprawa } = await api(page, 'POST', '/api/psa/portal/zadania', { spolka_id: 1, typ_zdarzenia: 'zdarzenie_inne', opis: 'Zwyczajne walne zgromadzenie (dane fikcyjne).' });
  await page.context().clearCookies();
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  await krok(page, 'Kolejka spraw', async () => {
    await page.goto('/#/sprawy');
    await ui.gotowe(page);
  });
  await krok(page, 'Sprawa — Rozpocznij weryfikację', async () => {
    await page.goto(`/#/sprawy/${sprawa.id}`);
    // Ten sam przycisk jest na ekranie dwa razy (pasek akcji sprawy i karta kreatora) — ustalenie w raporcie.
    await page.getByRole('button', { name: 'Rozpocznij weryfikację' }).first().click();
    await page.getByRole('button', { name: 'Ustal podstawę wpisu' }).waitFor({ timeout: 10000 });
  });
  await krok(page, 'Ustal podstawę wpisu', async () => {
    await page.getByRole('button', { name: 'Ustal podstawę wpisu' }).click();
    const rodzaj = ui.pole(page, 'Rodzaj dokumentu').locator('select');
    if (await rodzaj.isVisible().catch(() => false)) {
      await rodzaj.selectOption({ index: 1 });
      await ui.wpiszDate(page, 'Data dokumentu', DZIS);
    }
    await page.getByRole('button', { name: 'Zapisz podstawę' }).click();
    await page.locator('.card-h', { hasText: 'Co się zmienia' }).waitFor({ timeout: 10000 });
  });
  await krok(page, 'Co się zmienia → Weryfikacja → Dokonaj wpisu', async () => {
    const opis = ui.pole(page, 'Opis zdarzenia').locator('textarea');
    if (!(await opis.inputValue())) await opis.fill('Zwyczajne walne zgromadzenie (dane fikcyjne).');
    await page.getByRole('button', { name: 'Dalej', exact: true }).click();
    await page.locator('.card-h', { hasText: 'Weryfikacja i podgląd' }).waitFor({ timeout: 10000 });
    await ui.checklista(page);
    await page.getByRole('button', { name: 'Dokonaj wpisu' }).click();
    await page.getByRole('button', { name: 'Wróć do kokpitu spółki' }).waitFor({ timeout: 15000 });
  });
  await zakoncz(page);
});

test('K7: przeszkoda (brak danych) — wstrzymanie i wznowienie sprawy zbycia', async ({ page }, testInfo) => {
  await start(page, testInfo, 'przeszkoda', 'K7 wstrzymanie / wznowienie');
  await krok(page, 'Sprawa zbycia (seed) — Wstrzymaj', async () => {
    await page.goto('/#/sprawy/1');
    await page.getByRole('button', { name: 'Wstrzymaj' }).first().click();
    await ui.wpisz(page, 'Przeszkoda uniemożliwiająca wpis', 'Brak adresu nabywcy w dokumencie (dane fikcyjne).');
    // Przycisk w oknie nazywa czynność (A-017): „Wstrzymaj sprawę”, nie „Potwierdź”.
    await page.getByRole('dialog').getByRole('button', { name: 'Wstrzymaj sprawę' }).click();
    await page.getByRole('button', { name: 'Wznów' }).waitFor({ timeout: 10000 });
  });
  await krok(page, 'Wznów', async () => {
    await page.getByRole('button', { name: 'Wznów' }).click();
    await page.getByRole('button', { name: 'Wstrzymaj' }).first().waitFor({ timeout: 10000 });
  });
  await zakoncz(page);
});

test('K11: usunięcie listu z wysyłki (przed nadaniem)', async ({ page }, testInfo) => {
  await start(page, testInfo, 'list-usun-z-wysylki', 'K11 kolejka listów');
  await krok(page, 'Listy do wysyłki', async () => {
    await page.goto('/#/listy');
    await ui.gotowe(page, 'Usuń z wysyłki');
  });
  await krok(page, 'Usuń z wysyłki — powód', async () => {
    await page.getByRole('button', { name: 'Usuń z wysyłki' }).first().click();
    await page.getByRole('dialog').locator('textarea, input[type="text"]').first().fill('Zbywca wyraził zgodę w kancelarii (dane fikcyjne).');
    await page.getByRole('dialog').getByRole('button', { name: 'Usuń z wysyłki' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 });
  });
  await zakoncz(page);
});

test('K12: informacja z rejestru — kokpit (druk) i dla organu (dziennik)', async ({ page }, testInfo) => {
  await start(page, testInfo, 'informacja-kancelaria', 'K12 informacja z rejestru');
  await krok(page, 'Kokpit → informacja z rejestru', async () => {
    await page.goto('/#/spolki/1/wydruk');
    await ui.gotowe(page);
  });
  await krok(page, 'Dla organu — dziennik informacji', async () => {
    await page.goto('/#/informacje');
    await ui.pole(page, 'Spółka').locator('select').selectOption({ index: 1 });
    await ui.wpisz(page, 'Organ (odbiorca)', 'Komornik Sądowy przy SR Testowym');
    await ui.wpisz(page, 'Sygnatura sprawy', 'KM 2/26');
    await page.getByRole('button', { name: /Wydaj/ }).click();
    await page.getByText(/Wydano informację nr/).waitFor({ timeout: 10000 });
  });
  await zakoncz(page);
});

test('Żądanie spółki, której nie ma w kartotece — dopisanie spółki w kroku „Podstawa” (koszt)', async ({ page }, testInfo) => {
  await start(page, testInfo, 'spolka-zadajacy-spoza-kartoteki', 'K4 podstawa — spółka jako żądający');
  await krok(page, 'Nowa emisja → Podstawa', async () => {
    await page.goto('/#/spolki/1/zdarzenie?typ=emisja');
    await page.getByText('Podstawa wpisu', { exact: true }).waitFor();
  });
  await krok(page, 'Żądający: szukam „Alfa” — brak w kartotece', async () => {
    const wejscie = ui.pole(page, 'Żądający wpisu').getByRole('combobox');
    await wejscie.click();
    await wejscie.fill('Alfa');
    await page.waitForTimeout(800);
    const opcje = await ui.pole(page, 'Żądający wpisu').getByRole('option').allInnerTexts();
    if (opcje.some((t) => /Alfa/.test(t))) throw new Error('spółka jest w kartotece — ustalenie nieaktualne');
  });
  await krok(page, '+ Nowa osoba w kartotece — dane spółki drugi raz', async () => {
    // „+ Nowa osoba w kartotece” rozwija formularz osoby w samym polu (nie w oknie).
    await ui.pole(page, 'Żądający wpisu').getByRole('option', { name: /Nowa osoba/ }).click();
    const okno = ui.pole(page, 'Żądający wpisu');
    await okno.getByText('Osoba prawna lub spółka osobowa').click();
    await ui.wpisz(page, 'Firma (nazwa)', 'Alfa Testowa P.S.A.');
    await ui.wpisz(page, 'Numer w rejestrze (KRS lub zagranicznym)', '0000990001').catch(() => {});
    await ui.wpisz(page, 'Kod pocztowy', '80-001');
    await ui.wpisz(page, 'Miejscowość', 'Gdańsk');
    await ui.wpisz(page, 'Ulica', 'Testowa').catch(() => {});
    await ui.wpisz(page, 'Nr domu', '1');
    await okno.getByRole('button', { name: 'Dodaj do kartoteki' }).click();
    await okno.getByRole('button', { name: 'Dodaj do kartoteki' }).waitFor({ state: 'detached', timeout: 10000 });
  });
  await zakoncz(page);
});
