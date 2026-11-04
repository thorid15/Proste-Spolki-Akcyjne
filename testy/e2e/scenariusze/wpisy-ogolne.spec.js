'use strict';

/**
 * Wpis kreatorem ogólnym (K4) — każdy typ z `dostepneWKreatorze()` poza zbyciem (osobny przebieg, `zbycie.spec.js`).
 * Przebieg: kokpit → `#/spolki/1/zdarzenie?typ=…` (przycisk w kokpicie) → „Podstawa” → „Załóż sprawę i przejdź dalej”
 * → „Co się zmienia” → „Weryfikacja i podgląd” → „Dokonaj wpisu”.
 * Stan wstępny (obciążenie do wykreślenia, zajęcie do uchylenia) — zwykłym API, dane fikcyjne.
 * Persony: Anna Testowa (600 akcji serii A, zgoda e-mail), Bartosz Próbny (400, bez zgody), Celina Nabywczyni (bez akcji).
 */

const { test, zaloguj, api } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');

const DZIS = new Date().toISOString().slice(0, 10);
const EMISJA_A = 1;

/** Plan kroku „Co się zmienia”: [czynność, etykieta, wartość]. `?` na końcu etykiety = pole może się nie pokazać. */
async function wykonaj(page, plan) {
  for (const [co, etykieta0, wartosc] of plan) {
    const opcjonalne = etykieta0.endsWith('?');
    const etykieta = opcjonalne ? etykieta0.slice(0, -1) : etykieta0;
    const p = ui.pole(page, etykieta);
    if (opcjonalne && !(await p.isVisible().catch(() => false))) continue;
    await p.waitFor({ timeout: 8000 });
    if (co === 'wpisz') await ui.wpisz(page, etykieta, wartosc);
    if (co === 'data') await ui.wpiszDate(page, etykieta, wartosc || DZIS);
    if (co === 'kartoteka') await ui.wybierzZKartoteki(page, etykieta, wartosc);
    if (co === 'wybierz') await ui.wybierz(page, etykieta, wartosc);
    if (co === 'ulamek') {
      const pola = p.locator('input');
      await pola.nth(0).fill(wartosc[0]);
      await pola.nth(1).fill(wartosc[1]);
    }
    if (co === 'pierwsza') {
      const lista = p.locator('select').first();
      const v = await lista.evaluate((el) => [...el.options].find((o) => o.value !== '')?.value ?? null);
      if (v !== null) await lista.selectOption(v);
    }
  }
}

/** Spółka jako żądający musi być w kartotece (osoba prawna) — tu dopisana wcześniej; koszt ścieżki w UI: `inne.spec.js`. */
async function spolkaWKartotece(page) {
  await api(page, 'POST', '/api/psa/osoby', {
    typ: 'prawna', nazwa: 'Alfa Testowa P.S.A.', numer_w_rejestrze: '0000990001', nazwa_rejestru: 'KRS', kraj: 'Polska',
    kod_pocztowy: '80-001', miejscowosc: 'Gdańsk', ulica: 'Testowa', nr_domu: '1', aml_status: 'wykonane',
  });
}

async function przygotujObciazenie(page) {
  await api(page, 'POST', '/api/psa/spolki/1/zdarzenia', {
    typ: 'obciazenie',
    dane: { rodzaj: 'zastaw', emisja_zdarzenie_id: EMISJA_A, akcjonariusz_osoba_id: 1, osoba_id: 3, ilosc: 20, opis: 'Zastaw rejestrowy (dane fikcyjne)' },
  });
}

async function przygotujOrgan(page) {
  return (await api(page, 'POST', '/api/psa/osoby', {
    typ: 'prawna', nazwa: 'Komornik Sądowy przy Sądzie Rejonowym Testowym', kraj: 'Polska',
    kod_pocztowy: '80-100', miejscowosc: 'Gdańsk', ulica: 'Sądowa', nr_domu: '1', aml_status: 'wykonane',
  })).osoba;
}

/** Typy K4. `zadajacy` / `rola` — krok „Podstawa”; `zUrzedu` — bez żądającego. */
const TYPY = [
  { typ: 'emisja', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['wpisz', 'Oznaczenie serii', 'B'], ['wpisz', 'Liczba akcji', '100'], ['data', 'Data wpisu emisji do KRS', DZIS]] },
  { typ: 'umorzenie', zadajacy: 'Alfa Testowa', rola: 'spółka', powiadom: 'Anna', plan: [['wybierz', 'Seria akcji?', 'A'], ['pierwsza', 'Tryb umorzenia?'], ['wybierz', 'Akcjonariusz', 'Testowa'], ['wpisz', 'Liczba akcji', '10']] },
  { typ: 'uniewaznienie', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['wybierz', 'Seria akcji', 'A'], ['wpisz', 'Sąd, który wydał orzeczenie', 'Sąd Rejonowy Testowy'], ['wpisz', 'Sygnatura akt', 'I C 1/26'], ['data', 'Data orzeczenia', DZIS], ['wybierz', 'Akcjonariusz', 'Testowa'], ['wpisz', 'Liczba akcji', '10']] },
  { typ: 'zobowiazanie', zadajacy: 'Nabywczyni', rola: 'nabywca', powiadom: 'Anna', plan: [['kartoteka', 'Akcjonariusz składający oświadczenie', 'Anna'], ['pierwsza', 'Rodzaj zobowiązania'], ['wpisz', 'Treść oświadczenia', 'Zobowiązuję się przenieść 10 akcji serii A (dane fikcyjne).']] },
  { typ: 'obciazenie', zadajacy: 'Nabywczyni', rola: 'zastawnik', powiadom: 'Anna', plan: [['wybierz', 'Seria akcji?', 'A'], ['pierwsza', 'Rodzaj obciążenia?'], ['kartoteka', 'Akcjonariusz, którego akcje są obciążane', 'Anna'], ['kartoteka', 'Zastawnik / użytkownik', 'Nabywczyni'], ['wpisz', 'Liczba akcji', '10']] },
  { typ: 'wykreslenie_obciazenia', zadajacy: 'Anna', rola: 'akcjonariusz', przygotuj: przygotujObciazenie, plan: [['pierwsza', 'Obciążenie']] },
  { typ: 'prawo_glosu_zastawnika', zadajacy: 'Nabywczyni', rola: 'zastawnik', powiadom: 'Anna', przygotuj: przygotujObciazenie, plan: [['pierwsza', 'Obciążenie'], ['pierwsza', 'Prawo głosu?']] },
  { typ: 'zajecie', zUrzedu: true, znanyBlad: 'B-001', przygotuj: przygotujOrgan, plan: [['wybierz', 'Seria akcji', 'A'], ['kartoteka', 'Organ egzekucyjny', 'Komornik'], ['kartoteka', 'Akcjonariusz (dłużnik)', 'Próbny'], ['wpisz', 'Liczba akcji objętych zajęciem', '10']] },
  {
    typ: 'wykreslenie_zajecia', zUrzedu: true, znanyBlad: 'B-001',
    przygotuj: async (page) => {
      const organ = await przygotujOrgan(page);
      await api(page, 'POST', '/api/psa/spolki/1/zdarzenia', { typ: 'zajecie', dane: { emisja_zdarzenie_id: EMISJA_A, osoba_id: organ.id, akcjonariusz_osoba_id: 2, ilosc: 10 } });
    },
    plan: [['pierwsza', 'Zajęcie']],
  },
  { typ: 'zmiana_danych_akcjonariusza', zadajacy: 'Anna', rola: 'akcjonariusz', plan: [['kartoteka', 'Akcjonariusz', 'Anna'], ['wpisz', 'Miejscowość', 'Sopot']] },
  { typ: 'uprawnienie', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['pierwsza', 'Rodzaj'], ['pierwsza', 'Zakres'], ['wybierz', 'Seria akcji?', 'A'], ['kartoteka', 'Akcjonariusz?', 'Anna'], ['wpisz', 'Tytuł', 'Akcje uprzywilejowane co do głosu (dane fikcyjne)']] },
  { typ: 'ograniczenie', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['pierwsza', 'Zakres'], ['wybierz', 'Seria akcji?', 'A'], ['wpisz', 'Opis', 'Zbycie wymaga zgody spółki (dane fikcyjne)']] },
  { typ: 'zdarzenie_inne', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['wpisz', 'Opis zdarzenia', 'Zwyczajne walne zgromadzenie (dane fikcyjne)']] },
  { typ: 'sprostowanie', zadajacy: 'Alfa Testowa', rola: 'spółka', znanyBlad: 'B-002', plan: [['pierwsza', 'Prostowane zdarzenie?'], ['wpisz', 'Uzasadnienie?', 'Oczywista omyłka pisarska (dane fikcyjne)']] },
  { typ: 'przeniesienie_ulamka', zadajacy: 'Nabywczyni', rola: 'nabywca', powiadom: 'Anna', plan: [['wybierz', 'Seria akcji?', 'A'], ['wybierz', 'Zbywca', 'Testowa'], ['wpisz', 'Numer akcji', '1'], ['ulamek', 'Ułamek zbywanej części', ['1', '2']], ['kartoteka', 'Nabywca', 'Nabywczyni']] },
  { typ: 'przedstawiciel', zadajacy: 'Anna', rola: 'akcjonariusz', plan: [['wybierz', 'Seria akcji?', 'A'], ['wpisz', 'Numer akcji', '1'], ['kartoteka', 'Wspólny przedstawiciel?', 'Anna']] },
  { typ: 'pokrycie_akcji', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['wybierz', 'Seria akcji?', 'A'], ['kartoteka', 'Akcjonariusz', 'Anna'], ['pierwsza', 'Wzmianka o pokryciu']] },
];

/** Wspólny pomocnik (ui.checklista) — odhacza i czeka na aktywne „Dokonaj wpisu”. */
const checklista = (page) => ui.checklista(page);

async function przebieg(page, testInfo, def, { scenariusz } = {}) {
  rozpocznij(page, testInfo, { scenariusz: scenariusz || `wpis-${def.typ}`, proces: `K4 wpis ${def.typ}`, szerokosc: Number(testInfo.project.name), persona: def.zadajacy || 'z urzędu' });
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
  if (def.zadajacy === 'Alfa Testowa') await spolkaWKartotece(page);
  if (def.przygotuj) await def.przygotuj(page);
  await krok(page, 'Kokpit spółki', async () => {
    await page.goto('/#/spolki/1');
    await ui.gotowe(page, 'Alfa Testowa');
  });
  if (def.przezKafelek) {
    await krok(page, 'Co się stało (kafelki)', async () => {
      await page.goto('/#/spolki/1/zdarzenie');
      await page.getByText('Co się wydarzyło?', { exact: true }).waitFor();
      await page.locator('.kafelek-wyboru', { hasText: def.przezKafelek }).first().click();
      await page.getByText('Podstawa wpisu', { exact: true }).waitFor();
    });
  } else {
    await krok(page, 'Wybór czynności (przycisk w kokpicie)', async () => {
      await page.goto(`/#/spolki/1/zdarzenie?typ=${def.typ}`);
      await page.getByText('Podstawa wpisu', { exact: true }).waitFor();
    });
  }
  await krok(page, 'Podstawa', async () => {
    if (!def.zUrzedu) {
      await ui.wybierzZKartoteki(page, 'Żądający wpisu', def.zadajacy);
      await ui.wybierz(page, 'W jakim charakterze', def.rola);
      const rodzaj = ui.pole(page, 'Rodzaj dokumentu stanowiącego podstawę').locator('select');
      const v = await rodzaj.evaluate((el) => [...el.options].find((o) => o.value !== '')?.value ?? null);
      if (v) await rodzaj.selectOption(v);
      await ui.wpiszDate(page, 'Data dokumentu', DZIS);
    }
    await page.getByRole('button', { name: /Załóż sprawę/ }).click();
    await ui.gotowe(page, 'Co się zmienia');
  });
  await krok(page, 'Co się zmienia', async () => {
    await wykonaj(page, def.plan);
    await page.getByRole('button', { name: 'Dalej', exact: true }).click();
    await page.locator('.card-h', { hasText: 'Weryfikacja i podgląd' }).first().waitFor({ timeout: 10000 });
  });
  await krok(page, 'Weryfikacja i podgląd — wpis', async () => {
    if (def.powiadom) {
      // Uprzednie powiadomienie (art. 300(34) § 3) — w K4 adresata trzeba wskazać (w K5 jest domyślny, D-090).
      await ui.wybierzZKartoteki(page, 'Kogo powiadomić', def.powiadom);
      await page.getByRole('button', { name: 'Wyślij powiadomienie' }).click();
      await page.getByText('Powiadomienie wysłano').waitFor({ timeout: 10000 });
      // B-003: po wysłaniu kreator wraca do „Co się zmienia” — użytkownik musi kliknąć „Dalej” jeszcze raz.
      if (await page.locator('.card-h', { hasText: 'Co się zmienia' }).isVisible()) {
        await page.getByRole('button', { name: 'Dalej', exact: true }).click();
        await page.locator('.card-h', { hasText: 'Weryfikacja i podgląd' }).first().waitFor({ timeout: 10000 });
      }
    }
    await checklista(page);
    await page.getByRole('button', { name: 'Dokonaj wpisu' }).click();
    await page.getByRole('button', { name: 'Wróć do kokpitu spółki' }).waitFor({ timeout: 15000 });
  });
  await zakoncz(page);
}

for (const def of TYPY) {
  test(`wpis ${def.typ} — kreator ogólny`, async ({ page }, testInfo) => {
    // Znany błąd (docs/analiza/BLEDY.md): test ma się nie udać; gdy błąd zostanie naprawiony, Playwright zgłosi
    // „expected to fail” — wtedy usuń `znanyBlad`.
    test.fail(Boolean(def.znanyBlad), def.znanyBlad);
    await przebieg(page, testInfo, def);
  });
}

test('wpis zajecie — wybór kafelkiem w kroku „Co się stało” (ścieżka bez B-001)', async ({ page }, testInfo) => {
  const def = TYPY.find((t) => t.typ === 'zajecie');
  await przebieg(page, testInfo, { ...def, przezKafelek: /zajął akcje/ }, { scenariusz: 'wpis-zajecie-kafelek' });
});

test('emisja → objęcie z tej samej podstawy (przycisk „Wpisz, kto objął akcje”)', async ({ page }, testInfo) => {
  const emisja = TYPY.find((t) => t.typ === 'emisja');
  await przebieg(page, testInfo, emisja, { scenariusz: 'wpis-emisja-objecie' });
  page.__rejestrator._zapisano = false;
  await krok(page, 'Wpisz, kto objął akcje', async () => {
    await page.getByRole('button', { name: 'Wpisz, kto objął akcje' }).click();
    await ui.gotowe(page, 'Podstawa przeniesiona');
    await page.getByRole('button', { name: /Załóż sprawę/ }).click();
    await ui.gotowe(page, 'Co się zmienia');
  });
  await krok(page, 'Objęcie — co się zmienia', async () => {
    await wykonaj(page, [['kartoteka', 'Obejmujący?', 'Nabywczyni'], ['kartoteka', 'Akcjonariusz?', 'Nabywczyni'], ['wpisz', 'Liczba akcji', '100']]);
    await page.getByRole('button', { name: 'Dalej', exact: true }).click();
    await page.locator('.card-h', { hasText: 'Weryfikacja i podgląd' }).first().waitFor({ timeout: 10000 });
  });
  await krok(page, 'Objęcie — wpis', async () => {
    await checklista(page);
    await page.getByRole('button', { name: 'Dokonaj wpisu' }).click();
    await page.getByRole('button', { name: 'Wróć do kokpitu spółki' }).waitFor({ timeout: 15000 });
  });
  await zakoncz(page);
});

module.exports = { TYPY };
