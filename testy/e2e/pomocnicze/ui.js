'use strict';

/** Wspólne czynności na komponentach aplikacji (`Pole`, `PoleDaty`, `WyborZKartoteki`, `PasekAkcji`). */

/**
 * `.pole` z WŁASNĄ etykietą zawierającą tekst (etykieta bywa z dopiskiem „(opcjonalnie)”). Etykieta musi być
 * bezpośrednim dzieckiem pola — inaczej pole zewnętrzne (np. „Żądający wpisu” z formularzem nowej osoby w środku)
 * pasowałoby do etykiet pól zagnieżdżonych.
 */
function pole(page, etykieta) {
  return page.locator('.pole').filter({ has: page.locator(':scope > .pole-etykieta', { hasText: etykieta }) }).first();
}

/** Data w `PoleDaty` (segmenty DD MM RRRR) albo w natywnym `<input type="date">`. `data` — 'RRRR-MM-DD'. */
async function wpiszDate(page, etykieta, data) {
  const p = pole(page, etykieta);
  const [r, m, d] = data.split('-');
  const natywne = p.locator('input[type="date"]');
  if (await natywne.count()) { await natywne.fill(data); return; }
  await p.getByLabel('Dzień').fill(d);
  await p.getByLabel('Miesiąc').fill(m);
  await p.getByLabel('Rok').fill(r);
  await p.getByLabel('Rok').blur();
}

/** `WyborZKartoteki`: wpisuje fragment i wybiera pierwszą pasującą osobę. */
async function wybierzZKartoteki(page, etykieta, szukaj) {
  const p = pole(page, etykieta);
  const wejscie = p.getByRole('combobox');
  await wejscie.click();
  await wejscie.fill(szukaj);
  const opcja = p.getByRole('option').filter({ hasText: szukaj }).first();
  await opcja.waitFor({ timeout: 10000 });
  await opcja.click();
}

/** `<select>` w polu o etykiecie — opcja po fragmencie tekstu. */
async function wybierz(page, etykieta, tekstOpcji) {
  const lista = pole(page, etykieta).locator('select').first();
  const wartosc = await lista.evaluate((el, t) => {
    const o = [...el.options].find((x) => x.textContent.includes(t));
    return o ? o.value : null;
  }, tekstOpcji);
  if (wartosc === null) throw new Error(`brak opcji „${tekstOpcji}” w polu „${etykieta}”`);
  await lista.selectOption(wartosc);
}

async function wpisz(page, etykieta, tekst) {
  await pole(page, etykieta).locator('input, textarea').first().fill(String(tekst));
}

async function przycisk(page, nazwa, opcje = {}) {
  const b = page.getByRole('button', { name: nazwa, exact: opcje.exact !== false }).first();
  await b.click();
}

/** Ekran gotowy: brak szkieletu ładowania (`Spinner`). */
async function gotowe(page, tekst) {
  // Pierwszy WIDOCZNY element z tekstem — przy 390 px ten sam tekst bywa w ukrytym, zwiniętym menu.
  if (tekst) await page.getByText(tekst, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Checklista weryfikacji (człowiek odhacza — D-052): zaznacza każdą pozycję poza „uzasadnionymi wątpliwościami”
 * i czeka, aż „Dokonaj wpisu” będzie aktywne. Podgląd wczytuje się asynchronicznie i bywa, że przerysowuje listę
 * po zaznaczeniu — wtedy jeszcze raz (do 3 prób).
 */
async function checklista(page) {
  const wpis = page.getByRole('button', { name: 'Dokonaj wpisu' }).first();
  for (let proba = 0; proba < 3; proba += 1) {
    const pola = page.locator('.karta input[type="checkbox"]:visible');
    for (let i = 0; i < await pola.count(); i += 1) {
      const p = pola.nth(i);
      const tekst = await p.evaluate((el) => (el.closest('label') || el.parentElement).textContent).catch(() => '');
      if (/wątpliwości|wyraziła zgodę na wpis/i.test(tekst)) continue;
      if (!(await p.isChecked().catch(() => true))) await p.check().catch(() => {});
    }
    await page.waitForTimeout(400);
    if (await wpis.isEnabled().catch(() => false)) return;
  }
}

module.exports = { pole, wpiszDate, wybierzZKartoteki, wybierz, wpisz, przycisk, gotowe, checklista };
