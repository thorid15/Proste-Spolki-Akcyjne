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

/** Data w `PoleDaty` (jedno pole DD.MM.RRRR). `data` — 'RRRR-MM-DD'. */
async function wpiszDate(page, etykieta, data) {
  const [r, m, d] = data.split('-');
  await pole(page, etykieta).locator('.pole-daty-wejscie').fill(`${d}.${m}.${r}`);
}

/** `WyborOsoby`: wpisuje fragment i wybiera pierwszą pasującą osobę. */
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

/** Checklista sprawy (R5): odhacza wszystkie pozycje i czeka na zapis. */
async function checklista(page) {
  const karta = page.locator('.karta').filter({ has: page.getByText('Checklista', { exact: true }) });
  const pola = karta.locator('input[type="checkbox"]');
  for (let i = 0; i < await pola.count(); i += 1) {
    if (!(await pola.nth(i).isChecked())) {
      await pola.nth(i).check();
      await page.waitForLoadState('networkidle').catch(() => {});
    }
  }
}

module.exports = { pole, wpiszDate, wybierzZKartoteki, wybierz, wpisz, przycisk, gotowe, checklista };
