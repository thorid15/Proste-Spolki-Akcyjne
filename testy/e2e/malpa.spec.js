'use strict';

/**
 * „Małpa” (SESJA-PSA-ANALIZA-PRZEPLYWOW, Faza 2) — `npm run e2e:malpa`.
 *
 * Na każdym głównym ekranie: wylicza widoczne, aktywne przyciski i linki (poza wylogowaniem i paskiem trybu testowego;
 * nawigacja główna tylko na ekranie startowym) i klika każdy w świeżym stanie ekranu (ponowne wejście na adres).
 * Zgłasza: błędy JS, odpowiedzi HTTP ≥ 400, martwe przyciski (brak zmiany DOM, żądania, nawigacji, okna i pobrania
 * w 2 s), okna bez wyjścia (Esc ani „Anuluj”/„Zamknij”/✕ nie zamykają), okna natywne (alert/confirm).
 * Osobny test: pola przyjmujące oczywiście błędne dane (PESEL z błędną sumą, data z przyszłości tam, gdzie nie ma sensu).
 * Każdy ekran ma własny serwer w trybie testowym na świeżej bazie (strażnik w `srodowisko.js`).
 */

const fs = require('node:fs');
const path = require('node:path');
const { test, zaloguj } = require('./pomocnicze/srodowisko');
const { CZESCI } = require('./pomocnicze/krok');
const ui = require('./pomocnicze/ui');

const K = 'notariusz@example.com';
const EKRANY = [
  { nazwa: 'k-pulpit', konto: K, app: 'kancelaria', adres: '/#/', nawigacja: true },
  { nazwa: 'k-spolki', konto: K, app: 'kancelaria', adres: '/#/spolki' },
  { nazwa: 'k-kokpit', konto: K, app: 'kancelaria', adres: '/#/spolki/1' },
  { nazwa: 'k-sprawy', konto: K, app: 'kancelaria', adres: '/#/sprawy' },
  { nazwa: 'k-sprawa-zbycia', konto: K, app: 'kancelaria', adres: '/#/sprawy/1' },
  { nazwa: 'k-kreator-wpisu', konto: K, app: 'kancelaria', adres: '/#/spolki/1/zdarzenie?typ=emisja' },
  { nazwa: 'k-kreator-zbycia', konto: K, app: 'kancelaria', adres: '/#/spolki/1/zdarzenie?typ=przeniesienie' },
  { nazwa: 'k-osoby', konto: K, app: 'kancelaria', adres: '/#/osoby' },
  { nazwa: 'k-osoba', konto: K, app: 'kancelaria', adres: '/#/osoby/1' },
  { nazwa: 'k-listy', konto: K, app: 'kancelaria', adres: '/#/listy' },
  { nazwa: 'k-zawiadomienia', konto: K, app: 'kancelaria', adres: '/#/zawiadomienia' },
  { nazwa: 'k-przeniesienia', konto: K, app: 'kancelaria', adres: '/#/przeniesienia' },
  { nazwa: 'k-przeniesienie', konto: K, app: 'kancelaria', adres: '/#/przeniesienia/5' },
  { nazwa: 'k-wnioski', konto: K, app: 'kancelaria', adres: '/#/wnioski' },
  { nazwa: 'k-wniosek', konto: K, app: 'kancelaria', adres: '/#/wnioski/1' },
  { nazwa: 'k-oplaty', konto: K, app: 'kancelaria', adres: '/#/oplaty' },
  { nazwa: 'k-informacje', konto: K, app: 'kancelaria', adres: '/#/informacje' },
  { nazwa: 'k-zgloszenia', konto: K, app: 'kancelaria', adres: '/#/zgloszenia' },
  { nazwa: 'p-start', konto: 'zarzad@example.com', app: 'portal', adres: '/portal.html#/', nawigacja: true },
  { nazwa: 'p-spolka', konto: 'zarzad@example.com', app: 'portal', adres: '/portal.html#/spolka/1' },
  { nazwa: 'p-informacja', konto: 'zarzad@example.com', app: 'portal', adres: '/portal.html#/informacja/1' },
  { nazwa: 'p-zgloszenie', konto: 'zarzad@example.com', app: 'portal', adres: '/portal.html#/zgloszenie/1' },
  { nazwa: 'p-zgloszenie-bledu', konto: 'zarzad@example.com', app: 'portal', adres: '/portal.html#/zgloszenie-bledu/1' },
  { nazwa: 'p-platnosci', konto: 'anna.zgoda@example.com', app: 'portal', adres: '/portal.html#/platnosci' },
  { nazwa: 'p-konto', konto: 'anna.zgoda@example.com', app: 'portal', adres: '/portal.html#/konto' },
  { nazwa: 'p-wniosek-dokumenty', konto: 'gamma.zarzad@example.com', app: 'portal', adres: '/portal.html#/wniosek' },
  { nazwa: 'p-zglos-sie', konto: null, app: 'portal', adres: '/portal.html#/zglos-sie' },
];

/** Kandydaci do kliknięcia — widoczne, aktywne; poza ekranem startowym tylko z obszaru treści (`#tresc`). */
const WYBIERZ = (zNawigacja) => {
  const widoczny = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
  return [...document.querySelectorAll('button, a[href], [role="button"], [role="tab"]')]
    .filter((e) => widoczny(e) && !e.disabled && !e.closest('#psa-pasek-testowy'))
    .filter((e) => !/wyloguj/i.test(e.textContent) && !e.classList.contains('przeskocz-do-tresci'))
    .filter((e) => zNawigacja || e.closest('#tresc, main') || !document.querySelector('#tresc, main'));
};
const OPIS = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

async function kandydaci(page, { nawigacja }) {
  return page.evaluate(([wybierz, opis, zNawigacja]) => {
    const W = new Function(`return (${wybierz})`)(); const O = new Function(`return (${opis})`)();
    const licz = {};
    return W(zNawigacja).map((e) => {
      const tekst = O(e); const klucz = `${e.tagName}|${tekst}`;
      licz[klucz] = (licz[klucz] || 0) + 1;
      return { tag: e.tagName, tekst, nr: licz[klucz] - 1 };
    });
  }, [WYBIERZ.toString(), OPIS.toString(), Boolean(nawigacja)]);
}

/** Oznacza ten sam (n-ty widoczny o tym tekście) element po przeładowaniu ekranu. */
async function znajdz(page, k, nawigacja) {
  return page.evaluate(([wybierz, opis, kk, zNawigacja]) => {
    const W = new Function(`return (${wybierz})`)(); const O = new Function(`return (${opis})`)();
    const cel = W(zNawigacja).filter((e) => e.tagName === kk.tag && O(e) === kk.tekst)[kk.nr];
    if (!cel) return false;
    cel.setAttribute('data-malpa-cel', '1');
    return true;
  }, [WYBIERZ.toString(), OPIS.toString(), k, Boolean(nawigacja)]);
}

/** Świeży stan ekranu: pełne przeładowanie (sam `goto` na adres różniący się tylko `#…` nie przeładowuje SPA). */
async function otworz(page, ekran) {
  await page.goto('about:blank');
  await page.goto(ekran.adres);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

for (const ekran of EKRANY) {
  test(`małpa: ${ekran.nazwa}`, async ({ page, context }) => {
    test.setTimeout(10 * 60 * 1000);
    if (ekran.konto) await zaloguj(page, ekran.konto, ekran.app);
    const bledyJs = []; const http = []; const dialogi = [];
    page.on('pageerror', (e) => bledyJs.push(String(e.message).slice(0, 200)));
    page.on('response', (o) => { if (o.status() >= 400) http.push(`${o.request().method()} ${o.url().replace(/^https?:\/\/[^/]+/, '')} → ${o.status()}`); });
    page.on('dialog', async (d) => { dialogi.push(`${d.type()}: ${d.message().slice(0, 100)}`); await d.dismiss().catch(() => {}); });
    await otworz(page, ekran);
    const lista = await kandydaci(page, ekran);
    const problemy = [];
    for (const k of lista) {
      await otworz(page, ekran);
      if (!(await znajdz(page, k, ekran.nawigacja))) { problemy.push({ element: k.tekst, problem: 'nie odnaleziono po przeładowaniu (lista zależy od stanu)' }); continue; }
      const cel = page.locator('[data-malpa-cel="1"]').first();
      const p0 = { js: bledyJs.length, http: http.length, dialogi: dialogi.length };
      await page.evaluate(() => {
        window.__malpa = { zmiany: 0 };
        new MutationObserver((m) => { window.__malpa.zmiany += m.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      });
      let zadania = 0; let nawigacja = false; let okno = false; let pobranie = false;
      const naZadanie = (r) => { if (!/\.(png|jpg|svg|woff2?|css)$/.test(r.url())) zadania += 1; };
      const naNaw = (f) => { if (f === page.mainFrame()) nawigacja = true; };
      const naOkno = (p) => { okno = true; p.close().catch(() => {}); };
      const naPobranie = () => { pobranie = true; };
      page.on('request', naZadanie); page.on('framenavigated', naNaw); context.on('page', naOkno); page.on('download', naPobranie);
      const adresPrzed = page.url();
      // Przycisk wysyłający formularz z niespełnionym `required` — przeglądarka pokaże własny dymek (niewidoczny w DOM).
      const walidacjaNatywna = await cel.evaluate((e) => Boolean(e.form && (e.type === 'submit' || !e.getAttribute('type')) && !e.form.checkValidity()));
      const dialogiPrzed = await page.getByRole('dialog').count();
      try {
        await cel.click({ timeout: 3000 });
      } catch (e) {
        problemy.push({ element: k.tekst, problem: `nie da się kliknąć: ${String(e.message).split('\n')[0].slice(0, 100)}` });
      }
      const start = Date.now();
      let zmiany = 0;
      while (Date.now() - start < 2000) {
        zmiany = await page.evaluate(() => (window.__malpa ? window.__malpa.zmiany : 1)).catch(() => 1);
        if (zmiany || zadania || nawigacja || okno || pobranie || page.url() !== adresPrzed) break;
        await page.waitForTimeout(150);
      }
      page.off('request', naZadanie); page.off('framenavigated', naNaw); context.off('page', naOkno); page.off('download', naPobranie);
      if (!zmiany && !zadania && !nawigacja && !okno && !pobranie && page.url() === adresPrzed && dialogi.length === p0.dialogi) {
        problemy.push({ element: k.tekst, problem: walidacjaNatywna
          ? 'walidacja natywna przeglądarki (dymek „wypełnij to pole”) zamiast komunikatu aplikacji'
          : 'martwy przycisk (brak zmiany DOM, żądania, nawigacji w 2 s)' });
      }
      // Okno aplikacji (Modal role=dialog): czy da się wyjść?
      if (await page.getByRole('dialog').count() > dialogiPrzed) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        if (await page.getByRole('dialog').count() > dialogiPrzed) {
          const wyjscie = page.getByRole('dialog').last().getByRole('button', { name: /^(Anuluj|Zamknij|✕|Zostaw)/ });
          if (await wyjscie.count()) await wyjscie.first().click().catch(() => {});
          await page.waitForTimeout(300);
          problemy.push({ element: k.tekst, problem: (await page.getByRole('dialog').count()) > dialogiPrzed ? 'okno bez wyjścia (Esc i „Anuluj” nie zamykają)' : 'okno nie zamyka się klawiszem Esc (tylko przyciskiem)' });
        }
      }
      for (const b of bledyJs.slice(p0.js)) problemy.push({ element: k.tekst, problem: `błąd JS: ${b}` });
      for (const h of http.slice(p0.http)) problemy.push({ element: k.tekst, problem: `HTTP: ${h}` });
      for (const d of dialogi.slice(p0.dialogi)) problemy.push({ element: k.tekst, problem: `okno natywne ${d}` });
    }
    fs.mkdirSync(CZESCI, { recursive: true });
    fs.writeFileSync(path.join(CZESCI, `malpa-${ekran.nazwa}.json`), JSON.stringify({ malpa: true, ekran: ekran.nazwa, adres: ekran.adres, elementy: lista.length, problemy }, null, 2));
  });
}

/** Pola, które przyjmują oczywiście błędne dane (sprawdzenie po opuszczeniu pola / próbie zapisu). */
test('małpa: błędne dane w polach', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  await zaloguj(page, K, 'kancelaria');
  // „Masz niezapisane zmiany. Opuścić ten ekran…?” (rdzen.js) — tu celowo opuszczamy formularze.
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const wyniki = [];
  const bledyWidoczne = async () => page.locator('.pole-blad, .komunikat-blad, [aria-invalid="true"]').count();
  const ostrzezenia = async () => page.locator('.pole-ostrzezenie, .komunikat-uwaga').count();
  const sprawdz = async (gdzie, pole, wartosc, fn, przyjete) => {
    try {
      const przed = await bledyWidoczne(); const oPrzed = await ostrzezenia();
      await fn();
      await page.waitForTimeout(400);
      const po = await bledyWidoczne(); const oPo = await ostrzezenia();
      const akceptacja = await przyjete();
      wyniki.push({ gdzie, pole, wartosc, odrzucone: po > przed || !akceptacja, ostrzezenie: oPo > oPrzed });
    } catch (e) {
      wyniki.push({ gdzie, pole, wartosc, odrzucone: null, uwaga: `nie sprawdzono: ${String(e.message).split('\n')[0].slice(0, 120)}` });
    }
  };
  const etap = async (fn) => { try { await fn(); } catch (e) { wyniki.push({ gdzie: 'przygotowanie', uwaga: String(e.message).split('\n')[0].slice(0, 160) }); } };
  // Kartoteka — PESEL z błędną sumą kontrolną, data urodzenia z przyszłości.
  await etap(async () => {
    await page.goto('/#/osoby');
    await page.getByRole('button', { name: 'Nowa osoba', exact: true }).first().click();
    await ui.wpisz(page, 'Imię', 'Gustaw'); await ui.wpisz(page, 'Nazwisko', 'Błędny');
  });
  await sprawdz('kartoteka — nowa osoba', 'Numer PESEL', '85031502484 (zła suma)', async () => {
    await ui.wpisz(page, 'Numer PESEL', '85031502484');
    await ui.pole(page, 'Numer PESEL').locator('input').first().blur();
  }, async () => true);
  // Kreator wpisu (D-097) — data dokumentu i data wpływu z przyszłości w kroku „Podstawa”.
  await etap(async () => {
    await page.goto('/#/spolki/1/zdarzenie?typ=emisja');
    await ui.gotowe(page, 'Co się zmienia');
    await ui.wpisz(page, 'Oznaczenie serii', 'B'); await ui.wpisz(page, 'Liczba akcji', '100');
    await ui.przycisk(page, 'Dalej');
    await ui.pole(page, 'Data dokumentu').waitFor();
  });
  const jutro = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
  await sprawdz('kreator — Podstawa', 'Data dokumentu', `${jutro} (przyszłość)`, async () => ui.wpiszDate(page, 'Data dokumentu', jutro), async () => true);
  await etap(async () => { await ui.przycisk(page, 'Rodzaj dokumentu, data wpływu, notatka'); });
  await sprawdz('kreator — Podstawa', 'Data wpływu', `${jutro} (przyszłość)`, async () => ui.wpiszDate(page, 'Data wpływu', jutro), async () => true);
  // Zbycie — data umowy zbycia z przyszłości.
  await etap(async () => {
    await page.goto('/#/spolki/1/zdarzenie?typ=przeniesienie');
    await page.getByText('Co się zbywa').first().waitFor();
    await ui.wybierz(page, 'Zbywca', 'Testowa'); await ui.wpisz(page, 'Liczba zbywanych akcji', 5); await ui.wybierzZKartoteki(page, 'Nabywca', 'Nabywczyni');
    await ui.przycisk(page, 'Dalej');
    await ui.gotowe(page, 'Data umowy zbycia');
  });
  await sprawdz('zbycie — Podstawa', 'Data umowy zbycia', `${jutro} (przyszłość)`, async () => ui.wpiszDate(page, 'Data umowy zbycia', jutro),
    async () => page.getByRole('button', { name: 'Dalej', exact: true }).isEnabled());
  // Kolejka listów — data nadania z przyszłości.
  await etap(async () => {
    await page.goto('/#/listy');
    await page.getByRole('button', { name: 'Nadano' }).first().click();
  });
  await sprawdz('listy — nadanie', 'Data nadania', `${jutro} (przyszłość)`, async () => { await ui.wpiszDate(page, 'Data nadania', jutro); await ui.wpisz(page, 'Numer nadania', 'RR1PL'); },
    async () => page.getByRole('button', { name: 'Zapisz nadanie' }).isEnabled());
  // Portal (publiczny) — KRS z literami.
  await etap(async () => {
    await page.context().clearCookies();
    await page.goto('/portal.html#/zglos-sie');
    await ui.wpisz(page, 'E-mail', 'zly.krs@example.com');
  });
  await sprawdz('portal — Zgłoś się', 'Numer KRS spółki', '00009ABC01 (po próbie wysłania)', async () => {
    await ui.wpisz(page, 'Numer KRS spółki', '00009ABC01');
    await page.getByRole('button', { name: 'Zgłoś spółkę' }).click();
  }, async () => !(await page.getByText(/dziesięć cyfr/).count()));
  fs.mkdirSync(CZESCI, { recursive: true });
  fs.writeFileSync(path.join(CZESCI, 'malpa-bledne-dane.json'), JSON.stringify({ malpa: true, ekran: 'błędne dane', adres: '—', elementy: wyniki.length, problemy: wyniki.filter((w) => w.odrzucone === false).map((w) => ({ element: `${w.gdzie}: ${w.pole}`, problem: w.ostrzezenie ? `przyjmuje z ostrzeżeniem (bez blokady): ${w.wartosc}` : `przyjmuje oczywiście błędną wartość bez komunikatu: ${w.wartosc}` })), sprawdzone: wyniki }, null, 2));
});
