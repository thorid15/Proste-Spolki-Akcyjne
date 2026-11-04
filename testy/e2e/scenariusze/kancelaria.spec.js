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
  // „Aktywny” ustawia dopiero otwarcie rejestru zdarzeniem PRZEJĘCIE (server/trasy/spolki.js:939) — bez osobnego przejścia.
  // B-004 (naprawione): „Otwórz rejestr” prowadzi wprost do kreatora otwarcia (PRZEJĘCIE), nie do kokpitu.
  await krok(page, 'Otwórz rejestr → kreator otwarcia (PRZEJĘCIE)', async () => {
    await page.getByRole('button', { name: 'Otwórz rejestr', exact: true }).click();
    await page.waitForURL(/#\/spolki\/\d+\/otworz/, { timeout: 10000 });
    await ui.gotowe(page);
  });
  // D-095: otwarcie (to samo API co kreator otwarcia) bez wgrywania podpisanego protokołu — protokół i jego skrót
  // powstają przy otwarciu, w zdarzeniu PRZEJĘCIE.
  await krok(page, 'Otwarcie rejestru — PRZEJĘCIE z protokołem (D-095)', async () => {
    const osoba = (await api(page, 'POST', '/api/psa/osoby', { typ: 'fizyczna', imie: 'Teodor', nazwisko: 'Przejmowany', kraj: 'Polska', kod_pocztowy: '80-014', miejscowosc: 'Gdańsk', nr_domu: '14', aml_status: 'wykonane', bez_pesel: 1, data_urodzenia: '1970-01-01' })).osoba;
    const lista = ['forma', 'wpis_krs', 'uchwala', 'reprezentacja', 'umowa', 'jedna_umowa', 'dane_z_umowy', 'ograniczenia', 'bilans', 'zakres_danych', 'aml'];
    const wynik = await api(page, 'POST', `/api/psa/spolki/${theta.spolka_id}/otworz-rejestr`, {
      checklista: Object.fromEntries(lista.map((k) => [k, true])),
      zdarzenia: [
        { typ: 'emisja', klucz_tymczasowy: 'e1', dane: { seria: 'A', nr_pierwszy: 1, ilosc: 100, data_wpisu_krs: '2025-03-15', rodzaj_akcji: 'zwykla' } },
        { typ: 'objecie', dane: { emisja_zdarzenie_id: { __odwolanie_do_partii: 'e1' }, pozycje: [{ osoba_id: osoba.id, ilosc: 100, pokryta: 'tak' }] } },
      ],
    });
    const idPrzejecia = wynik.zdarzenia.find((z) => z.typ === 'przejecie').id;
    const zdarzenie = await api(page, 'GET', `/api/psa/zdarzenia/${idPrzejecia}`);
    const przejecie = JSON.stringify(zdarzenie).match(/"protokol":\{[^}]*"sha256":"[0-9a-f]{64}"/);
    const { przeniesienia: po } = await api(page, 'GET', '/api/psa/przeniesienia');
    if (po.find((x) => x.id === theta.id).status !== 'aktywny') throw new Error('przeniesienie nie jest „Aktywny” po otwarciu');
    if (!przejecie) throw new Error(`brak skrótu protokołu w PRZEJĘCIU: ${JSON.stringify(zdarzenie).slice(0, 300)}`);
  });
  await zakoncz(page);
});

test('D-103: sprostowanie zdarzenia — przycisk „Sprostuj” w historii zdarzeń kokpitu', async ({ page }, testInfo) => {
  await start(page, testInfo, 'sprostowanie-z-historii', 'K8 sprostowanie (jedna droga)');
  await krok(page, 'Kokpit → historia zdarzeń', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Alfa Testowa');
    const sprostuj = page.getByRole('button', { name: 'Sprostuj', exact: true });
    if (!(await sprostuj.first().isVisible().catch(() => false))) await page.getByRole('button', { name: /Historia zdarzeń/ }).first().click();
    await sprostuj.first().waitFor({ timeout: 10000 });
  });
  await krok(page, 'Sprostuj — uzasadnienie i zapis', async () => {
    await page.getByRole('button', { name: 'Sprostuj', exact: true }).first().click();
    await page.getByRole('dialog').locator('textarea').last().fill('Oczywista omyłka pisarska w opisie (dane fikcyjne).');
    await page.getByRole('dialog').getByRole('button', { name: 'Zapisz sprostowanie' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 });
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
  await krok(page, 'Sprawa — weryfikacja sama przy otwarciu (D-098)', async () => {
    await page.goto(`/#/sprawy/${sprawa.id}`);
    await page.getByRole('button', { name: 'Ustal podstawę wpisu' }).waitFor({ timeout: 10000 });
    if (await page.getByRole('button', { name: 'Rozpocznij weryfikację' }).count()) throw new Error('D-098: „Rozpocznij weryfikację” nadal na ekranie');
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

test('D-096: żądanie spółki — spółka z rejestru jako żądający, bez dopisywania do kartoteki', async ({ page }, testInfo) => {
  await start(page, testInfo, 'spolka-zadajacy', 'K4 podstawa — spółka jako żądający (D-096)');
  await krok(page, 'Nowa emisja → Podstawa', async () => {
    await page.goto('/#/spolki/1/zdarzenie?typ=emisja');
    await page.getByText('Podstawa wpisu', { exact: true }).waitFor();
  });
  await krok(page, 'Żądający = spółka (domyślnie) → Załóż sprawę', async () => {
    await ui.pole(page, 'Żądający wpisu').getByText('Alfa Testowa').waitFor({ timeout: 5000 });
    if (await ui.pole(page, 'Żądający wpisu').getByRole('combobox').count()) throw new Error('D-096: wybór z kartoteki zamiast spółki');
    await page.getByRole('button', { name: /Załóż sprawę/ }).click();
    await page.locator('.card-h', { hasText: 'Co się zmienia' }).waitFor({ timeout: 10000 });
  });
  await zakoncz(page);
});
