'use strict';

/**
 * Wpis kreatorem wpisu (K4, D-097) — każdy typ z `dostepneWKreatorze()` poza zbyciem (`zbycie.spec.js`, ten sam kreator).
 * Przebieg: kokpit → `#/spolki/1/zdarzenie?typ=…` (przycisk w kokpicie) → „Co się zmienia” → „Podstawa”
 * (sprawa w tle) → „Sprawdzenie i wpis” → „Dokonaj wpisu”.
 * Stan wstępny (obciążenie do wykreślenia, zajęcie do uchylenia) — zwykłym API, dane fikcyjne.
 * Persony: Anna Testowa (600 akcji serii A, zgoda e-mail), Bartosz Próbny (400, bez zgody), Celina Nabywczyni (bez akcji).
 */

const { test, zaloguj, api } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');
const L = require('../../../publiczne/js/wpis-zbycia-logika.js');

const DZIS = new Date().toISOString().slice(0, 10);
const EMISJA_A = 1;

/** Plan kroku „Co się zmienia”: [czynność, etykieta, wartość]. `?` na końcu etykiety = pole może się nie pokazać. */
async function wykonaj(page, plan) {
  for (const [co, etykieta0, wartosc] of plan) {
    if (co === 'klik') { await ui.przycisk(page, etykieta0); continue; }
    if (co === 'zapiszOsobe') { await ui.zapiszOsobe(page); continue; }
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
  { typ: 'zobowiazanie', zadajacy: 'Nabywczyni', rola: 'nabywca', powiadom: 'Anna', plan: [['wybierz', 'Akcjonariusz składający oświadczenie', 'Testowa'], ['pierwsza', 'Rodzaj zobowiązania'], ['wpisz', 'Treść oświadczenia', 'Zobowiązuję się przenieść 10 akcji serii A (dane fikcyjne).']] },
  { typ: 'obciazenie', zadajacy: 'Nabywczyni', rola: 'zastawnik', powiadom: 'Anna', plan: [['wybierz', 'Seria akcji?', 'A'], ['pierwsza', 'Rodzaj obciążenia?'], ['wybierz', 'Akcjonariusz, którego akcje są obciążane', 'Testowa'], ['kartoteka', 'Zastawnik / użytkownik', 'Nabywczyni'], ['wpisz', 'Liczba akcji', '10']] },
  { typ: 'wykreslenie_obciazenia', zadajacy: 'Anna', rola: 'akcjonariusz', przygotuj: przygotujObciazenie, plan: [['pierwsza', 'Obciążenie']] },
  { typ: 'prawo_glosu_zastawnika', zadajacy: 'Nabywczyni', rola: 'zastawnik', powiadom: 'Anna', przygotuj: przygotujObciazenie, plan: [['pierwsza', 'Obciążenie'], ['pierwsza', 'Prawo głosu?']] },
  { typ: 'zajecie', zUrzedu: true, przygotuj: przygotujOrgan, plan: [['wybierz', 'Seria akcji', 'A'], ['kartoteka', 'Organ egzekucyjny', 'Komornik'], ['wybierz', 'Akcjonariusz (dłużnik)', 'Próbny'], ['wpisz', 'Liczba akcji objętych zajęciem', '10']] },
  {
    typ: 'wykreslenie_zajecia', zUrzedu: true,
    przygotuj: async (page) => {
      const organ = await przygotujOrgan(page);
      await api(page, 'POST', '/api/psa/spolki/1/zdarzenia', { typ: 'zajecie', dane: { emisja_zdarzenie_id: EMISJA_A, osoba_id: organ.id, akcjonariusz_osoba_id: 2, ilosc: 10 } });
    },
    plan: [['pierwsza', 'Zajęcie']],
  },
  // D-102: nowe dane — formularzem kartoteki (raz), kreator przejmuje je jako „po”.
  { typ: 'zmiana_danych_akcjonariusza', zadajacy: 'Anna', rola: 'akcjonariusz', plan: [['wybierz', 'Akcjonariusz', 'Testowa'], ['klik', 'Wpisz nowe dane'], ['wpisz', 'Miejscowość', 'Sopot'], ['zapiszOsobe']] },
  { typ: 'uprawnienie', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['pierwsza', 'Rodzaj'], ['pierwsza', 'Zakres'], ['wybierz', 'Seria akcji?', 'A'], ['wybierz', 'Akcjonariusz?', 'Testowa'], ['wpisz', 'Tytuł', 'Akcje uprzywilejowane co do głosu (dane fikcyjne)']] },
  { typ: 'ograniczenie', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['pierwsza', 'Zakres'], ['wybierz', 'Seria akcji?', 'A'], ['wpisz', 'Opis', 'Zbycie wymaga zgody spółki (dane fikcyjne)']] },
  { typ: 'zdarzenie_inne', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['wpisz', 'Opis zdarzenia', 'Zwyczajne walne zgromadzenie (dane fikcyjne)']] },
  { typ: 'przeniesienie_ulamka', zadajacy: 'Nabywczyni', rola: 'nabywca', powiadom: 'Anna', plan: [['wybierz', 'Seria akcji?', 'A'], ['wybierz', 'Zbywca', 'Testowa'], ['wpisz', 'Numer akcji', '1'], ['ulamek', 'Ułamek zbywanej części', ['1', '2']], ['kartoteka', 'Nabywca', 'Nabywczyni']] },
  { typ: 'przedstawiciel', zadajacy: 'Anna', rola: 'akcjonariusz', plan: [['wybierz', 'Seria akcji?', 'A'], ['wpisz', 'Numer akcji', '1'], ['kartoteka', 'Wspólny przedstawiciel?', 'Anna']] },
  { typ: 'pokrycie_akcji', zadajacy: 'Alfa Testowa', rola: 'spółka', plan: [['wybierz', 'Seria akcji?', 'A'], ['wybierz', 'Akcjonariusz', 'Testowa'], ['pierwsza', 'Wzmianka o pokryciu']] },
];

/** Wspólny pomocnik (ui.checklista) — odhacza i czeka na aktywne „Dokonaj wpisu”. */
const checklista = (page) => ui.checklista(page);

/**
 * Krok „Podstawa”: charakter żądającego domyślny z typu (A-013), spółka bez kartoteki (D-096), osoba podstawiona
 * z kroku „Co”, gdy z niego wynika (D-097) — inaczej wybór z kartoteki; rodzaj dokumentu domyślny (A-005) — tylko data.
 */
async function podstawa(page, def) {
  const oczekiwany = L.domyslnyCharakterZadajacego(def.typ) || 'spolka';
  const charakter = await ui.pole(page, 'W jakim charakterze').locator('select').inputValue();
  if (charakter !== oczekiwany) throw new Error(`A-013: „W jakim charakterze” = „${charakter}”, oczekiwano „${oczekiwany}”`);
  const zadajacy = ui.pole(page, 'Żądający wpisu');
  if (charakter === 'spolka') {
    await zadajacy.getByText('Alfa Testowa').waitFor({ timeout: 5000 });
  } else if (await zadajacy.locator('.kartoteka-wybrana').count()) {
    const kto = await zadajacy.locator('.kartoteka-wybrana').textContent();
    if (!kto.includes(def.zadajacy)) throw new Error(`D-097: podstawiony żądający „${kto}”, oczekiwano „${def.zadajacy}”`);
  } else {
    await ui.wybierzZKartoteki(page, 'Żądający wpisu', def.zadajacy);
  }
  await ui.wpiszDate(page, 'Data dokumentu', DZIS);
}

async function przebieg(page, testInfo, def, { scenariusz } = {}) {
  rozpocznij(page, testInfo, { scenariusz: scenariusz || `wpis-${def.typ}`, proces: `K4 wpis ${def.typ}`, szerokosc: Number(testInfo.project.name), persona: def.zadajacy || 'z urzędu' });
  await zaloguj(page, 'notariusz@example.com', 'kancelaria');
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
      await ui.gotowe(page, 'Co się zmienia');
    });
  } else {
    await krok(page, 'Wybór czynności (przycisk w kokpicie)', async () => {
      await page.goto(`/#/spolki/1/zdarzenie?typ=${def.typ}`);
      await ui.gotowe(page, 'Co się zmienia');
    });
  }
  await krok(page, 'Co się zmienia', async () => {
    await wykonaj(page, def.plan);
    await ui.przycisk(page, 'Dalej');
    await ui.pole(page, 'Data dokumentu').waitFor({ timeout: 10000 });
  });
  await krok(page, 'Podstawa', async () => {
    if (!def.zUrzedu) await podstawa(page, def);
    await ui.przycisk(page, 'Dalej');
    await page.getByRole('button', { name: 'Dokonaj wpisu' }).waitFor({ timeout: 15000 });
  });
  await krok(page, 'Sprawdzenie i wpis', async () => {
    if (def.powiadom) {
      // D-104: adresat uprzedniego powiadomienia (art. 300(34) § 3) podpowiedziany z danych wpisu — bez wyboru.
      const wyslij = page.getByRole('button', { name: 'Wyślij powiadomienie' });
      await page.waitForTimeout(500);
      if (!(await wyslij.isEnabled())) throw new Error('D-104: adresat powiadomienia nie został podpowiedziany');
      await wyslij.click();
      await page.getByText('Powiadomienie wysłano').waitFor({ timeout: 10000 });
      // B-003: po wysłaniu kreator zostaje w „Sprawdzeniu i wpisie”.
      await page.waitForTimeout(800);
      if (!(await page.getByRole('button', { name: 'Dokonaj wpisu' }).isVisible())) throw new Error('B-003: kreator wyszedł ze „Sprawdzenia i wpisu”');
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
    await ui.gotowe(page, 'Co się zmienia');
  });
  await krok(page, 'Objęcie — co się zmienia', async () => {
    await wykonaj(page, [['kartoteka', 'Obejmujący?', 'Nabywczyni'], ['kartoteka', 'Akcjonariusz?', 'Nabywczyni'], ['wpisz', 'Liczba akcji', '100']]);
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Podstawa przeniesiona');
  });
  await krok(page, 'Objęcie — podstawa z emisji', async () => {
    await ui.przycisk(page, 'Dalej');
    await page.getByRole('button', { name: 'Dokonaj wpisu' }).waitFor({ timeout: 15000 });
  });
  await krok(page, 'Objęcie — wpis', async () => {
    await checklista(page);
    await page.getByRole('button', { name: 'Dokonaj wpisu' }).click();
    await page.getByRole('button', { name: 'Wróć do kokpitu spółki' }).waitFor({ timeout: 15000 });
  });
  await zakoncz(page);
});

module.exports = { TYPY };
